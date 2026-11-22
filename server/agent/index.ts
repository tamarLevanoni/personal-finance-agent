import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { Expense } from './types';

const LLM_MODEL = 'gemma-4-31b-it';

export class FinanceAgent {
  private expenses: Expense[];

  constructor(expenses: Expense[]) {
    this.expenses = expenses;
  }

  async run(query: string): Promise<string> {
    const result = await generateText({
      model: google(LLM_MODEL),
      prompt: query,
    });

    return result.text;
  }
}
