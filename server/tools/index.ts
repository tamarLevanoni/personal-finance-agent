import type { TypedToolCall } from 'ai';
import type { Expense } from '../agent/types';
import { calculateExpenseStats, createExpenseStatsTool } from './calculate-expense-stats';
import { listExpenses, createListExpensesTool } from './list-expenses';
import { groupExpensesByCategory, createGroupExpensesByCategoryTool } from './group-expenses-by-category';
import { compareExpenses, createCompareExpensesTool } from './compare-expenses';
import { createExpenseFilterSchema } from './expense-filter-schema';

// Give the model descriptions and schemas without automatic execute callbacks.
export function createFinanceTools() {
  // Share one category-aware filter schema across all tool definitions.
  const filters = createExpenseFilterSchema();
  return {
    calculateExpenseStats: createExpenseStatsTool(filters),
    listExpenses: createListExpensesTool(filters),
    groupExpensesByCategory: createGroupExpensesByCategoryTool(filters),
    compareExpenses: createCompareExpensesTool(filters),
  };
}

type FinanceToolCall = TypedToolCall<ReturnType<typeof createFinanceTools>>;

// Run the selected function locally after the SDK validates the model's input.
export function executeFinanceTool(expenses: Expense[], call: FinanceToolCall) {
  // The SDK marks unknown tools or schema-invalid inputs as dynamic calls.
  if (call.dynamic || call.invalid) throw new Error('Unknown tool or invalid input');

  const result = { type: 'tool-result' as const, toolCallId: call.toolCallId };
  switch (call.toolName) {
    case 'calculateExpenseStats':
      return { ...result, toolName: call.toolName, input: call.input, output: calculateExpenseStats(expenses, call.input) };
    case 'listExpenses':
      return { ...result, toolName: call.toolName, input: call.input, output: listExpenses(expenses, call.input) };
    case 'groupExpensesByCategory':
      return { ...result, toolName: call.toolName, input: call.input, output: groupExpensesByCategory(expenses, call.input) };
    case 'compareExpenses':
      return { ...result, toolName: call.toolName, input: call.input, output: compareExpenses(expenses, call.input) };
    default:
      throw new Error('Unknown tool');
  }
}

export type FinanceToolResult = ReturnType<typeof executeFinanceTool>;
