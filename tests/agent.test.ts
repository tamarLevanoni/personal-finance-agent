import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MockLanguageModelV4 } from 'ai/test';
import { FinanceAgent } from '../server/agent';

type MockResponse = Awaited<ReturnType<MockLanguageModelV4['doGenerate']>>;

function response(content: MockResponse['content'], finish: MockResponse['finishReason']['unified'] = 'tool-calls'): MockResponse {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    warnings: [],
  };
}

test('multiple tools in one response are executed without additional model calls', async () => {
  const model = new MockLanguageModelV4({ doGenerate: [
    response([
      { type: 'tool-call', toolCallId: 'sum', toolName: 'calculateExpenseStats', input: JSON.stringify({ operation: 'sum' }) },
      { type: 'tool-call', toolCallId: 'groups', toolName: 'groupExpensesByCategory', input: '{}' },
    ]),
    response([{ type: 'text', text: 'What would you like to compare?' }], 'stop'),
  ] });
  const agent = new FinanceAgent([
    { amount: 10, date: '2025-11-01', category: 'groceries', vendor: 'Market' },
    { amount: 20, date: '2025-11-01', category: 'dining', vendor: 'Cafe' },
  ], model);
  const answer = await agent.run('Show total and spending by category');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.ok(answer.includes('30.00'));
  await agent.run('Compare those results');
  const priorMessages = model.doGenerateCalls[1].prompt.filter(message => message.role !== 'system');
  assert.equal(priorMessages.length, 3);
  const summary = JSON.stringify(priorMessages[1]);
  assert.ok(summary.includes('calculateExpenseStats'));
  assert.ok(summary.includes('groupExpensesByCategory'));
  assert.ok(summary.includes('30'));
  assert.equal(model.doGenerateCalls.length, 2);
});

test('follow-ups receive filters and counts but no previous transaction list or formatted answer', async () => {
  const model = new MockLanguageModelV4({ doGenerate: [
    response([{ type: 'tool-call', toolCallId: 'nov', toolName: 'listExpenses', input: JSON.stringify({ category: 'groceries', startDate: '2025-11-01', endDate: '2025-12-01' }) }]),
    response([{ type: 'tool-call', toolCallId: 'oct', toolName: 'listExpenses', input: JSON.stringify({ category: 'groceries', startDate: '2025-10-01', endDate: '2025-11-01' }) }]),
  ] });
  const agent = new FinanceAgent([
    { amount: 12.5, date: '2025-11-01', category: 'groceries', vendor: 'PRIVATE_STORE' },
    { amount: 20, date: '2025-10-01', category: 'groceries', vendor: 'OTHER_STORE' },
  ], model);
  await agent.run('Show my groceries from November');
  await agent.run('What about the month before?');
  assert.equal(model.doGenerateCalls.length, 2);
  const prompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.ok(prompt.includes('2025-11-01'));
  assert.ok(prompt.includes('totalCount'));
  assert.equal(prompt.includes('PRIVATE_STORE'), false);
  assert.equal(prompt.includes('tool-result'), false);
});

test('a clarification is returned directly and retained for the next user response', async () => {
  const clarification = 'Which month and category would you like to see?';
  const model = new MockLanguageModelV4({ doGenerate: [
    response([{ type: 'text', text: clarification }], 'stop'),
    response([{ type: 'tool-call', toolCallId: 'list', toolName: 'listExpenses', input: JSON.stringify({
      category: 'groceries', startDate: '2025-11-01', endDate: '2025-12-01',
    }) }]),
  ] });
  const agent = new FinanceAgent([], model);
  const answer = await agent.run('Show those expenses');
  assert.equal(answer, clarification);
  assert.equal(model.doGenerateCalls.length, 1);
  await agent.run('Groceries in November 2025');
  const nextPrompt = JSON.stringify(model.doGenerateCalls[1].prompt);
  assert.ok(nextPrompt.includes('Show those expenses'));
  assert.ok(nextPrompt.includes(clarification));
  assert.equal(model.doGenerateCalls.length, 2);
});
