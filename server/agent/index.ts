import { generateText } from 'ai';
import type { LanguageModel, ModelMessage } from 'ai';
import { google } from '@ai-sdk/google';
import type { Expense } from './types';
import { createFinanceTools, executeFinanceTool, type FinanceToolResult } from '../tools';
import { formatToolResult, noToolMessage, partialFailureMessage } from './format-answer';

const LLM_MODEL = 'gemma-4-31b-it';
const SYSTEM_PROMPT = `You are a personal finance assistant. Today is 2025-12-30. Resolve relative dates using this date.
Previous assistant messages contain compact records of prior analyses, including their parameters and small results. Use these records to understand follow-ups and comparisons. Retrieve transaction details again with tools when needed; prior transaction lists are not stored.
All arithmetic and final financial answers are produced by application code. Select all tool calls needed in this single step; their results will not be sent back to you. Do not calculate numbers or write a final financial answer.
For greetings, general explanations, or clarification questions, respond directly without calling a tool. If required context is missing, ask for it. If a request is unsupported, explain the limitation. Never provide numerical financial results without tools.`;

// Preserve enough context to repeat or refine an analysis without retaining rows.
export function summarizeToolResult(result: FinanceToolResult) {
  const { output } = result;
  return {
    tool: result.toolName,
    parameters: result.input,
    // Keep counts for lists; statistics and category summaries are already small.
    result: 'expenses' in output ? { totalCount: output.totalCount } : output,
  };
}

export class FinanceAgent {
  private expenses: Expense[];
  private memory: ModelMessage[] = [];
  private model: LanguageModel;
  private tools: ReturnType<typeof createFinanceTools>;

  constructor(expenses: Expense[], model: LanguageModel = google(LLM_MODEL)) {
    this.expenses = expenses;
    this.model = model;
    // Tool schemas use the fixed categories declared in types.ts.
    this.tools = createFinanceTools();
  }

  async run(query: string): Promise<string> {
    // Reuse stored messages and keep the new question temporary until success.
    const question: ModelMessage = { role: 'user', content: query };
    const messages = [...this.memory, question];

    // Make one planning request; tool results are never sent back for narration.
    const result = await generateText({
      model: this.model,
      system: SYSTEM_PROMPT,
      messages,
      tools: this.tools,
    });

    switch (result.finishReason) {
      case 'stop': {
        // A completed text response can clarify a request without any tools.
        this.memory.push(question, { role: 'assistant', content: result.text });
        return result.text;
      }
      case 'tool-calls': {
        const answers: string[] = [];
        const analyses: ReturnType<typeof summarizeToolResult>[] = [];
        let hasToolErrors = false;

        for (const call of result.toolCalls) {
          try {
            // Format and summarize immediately; do not accumulate raw results.
            const toolResult = executeFinanceTool(this.expenses, call);
            answers.push(formatToolResult(toolResult));
            analyses.push(summarizeToolResult(toolResult));
          } catch {
            hasToolErrors = true;
          }
        }

        // Serialize each compact summary once, when saving the successful turn.
        if (analyses.length > 0) {
          this.memory.push(question, {
            role: 'assistant',
            content: JSON.stringify({ analyses }),
          });
        }

        const answer = answers.length > 0 ? answers.join('\n\n---\n\n') : noToolMessage();
        return hasToolErrors ? `${answer}\n\n${partialFailureMessage()}` : answer;
      }
      // Incomplete or blocked responses are not executed or saved in memory.
      case 'length':
        return 'The response reached the output limit before it was complete. Please try again.';
      case 'content-filter':
        return "The response was blocked by the model's content filter.";
      case 'error':
        return 'The model could not complete the response. Please try again.';
      case 'interrupted':
        return 'The response was interrupted. Please try again.';
      case 'other':
        return 'The model stopped unexpectedly. Please try again.';
    }
  }
}
