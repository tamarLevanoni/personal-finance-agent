import { tool } from 'ai';
import { z } from 'zod';
import type { Expense } from '../agent/types';
import { sum, mean, median } from '../utils/math-helpers';
import { filterExpenses, type ExpenseFilters } from './filter-expenses';
import type { ExpenseFilterSchema } from './expense-filter-schema';

interface ExpenseStatsInput extends ExpenseFilters {
  operation: 'sum' | 'mean' | 'median';
}

export function calculateExpenseStats(expenses: Expense[], input: ExpenseStatsInput) {
  const matchingExpenses = filterExpenses(expenses, input);
  const count = matchingExpenses.length;
  const { operation } = input;

  // With no transactions, a total is zero but an average/median is undefined.
  if (count === 0) {
    return { operation, value: operation === 'sum' ? 0 : null, count };
  }

  // Calculate in cents and round the final result back to two decimal places.
  const amountsInCents = matchingExpenses.map(expense =>
    Math.round(expense.amount * 100)
  );
  const calculations = { sum, mean, median };
  const value = Math.round(calculations[operation](amountsInCents)) / 100;

  return { operation, value, count };
}

// The schema describes the request; execution is handled manually in tools/index.ts.
export function createExpenseStatsTool(filters: ExpenseFilterSchema) {
  return tool({
    description: 'Calculate the sum, mean, or median of individual expense amounts, optionally filtered by category, vendor, dates, and transaction amounts. All supplied filters must match. Omit filters to use the entire history. Returns the operation, value rounded to two decimal places, and matching transaction count. A null value means there are no matching transactions for a mean or median.',
    inputSchema: filters.extend({
      operation: z.enum(['sum', 'mean', 'median'])
        .describe('sum: total spending; mean: average transaction amount; median: middle transaction amount when sorted.'),
    }),
  });
}
