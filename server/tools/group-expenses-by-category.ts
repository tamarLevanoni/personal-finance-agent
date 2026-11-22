import { tool } from 'ai';
import { z } from 'zod';
import type { Expense } from '../agent/types';
import { groupBy } from '../utils/array-helpers';
import { sum } from '../utils/math-helpers';
import type { ExpenseFilterSchema } from './expense-filter-schema';
import { filterExpenses, type ExpenseFilters } from './filter-expenses';

interface GroupExpensesInput extends ExpenseFilters {
  topN?: number;
}

export function groupExpensesByCategory(
  expenses: Expense[],
  { topN, ...filters }: GroupExpensesInput = {}
) {
  const matchingExpenses = filterExpenses(expenses, filters);
  const groups = groupBy(matchingExpenses, expense => expense.category ?? 'uncategorized');

  const summaries = Object.entries(groups).map(([category, entries]) => ({
    category,
    total: sum(entries.map(expense => Math.round(expense.amount * 100))) / 100,
    count: entries.length,
  })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));

  return topN === undefined ? summaries : summaries.slice(0, topN);
}

export function createGroupExpensesByCategoryTool(filters: ExpenseFilterSchema) {
  return tool({
    description: 'Show spending broken down by category. Returns one summary per category with total spending and transaction count, ordered by total descending. Uncategorized transactions are grouped under uncategorized. Filters apply before grouping. Use this for spending by category, rather than listing individual transactions.',
    inputSchema: filters.extend({
      topN: z.number().int().positive().optional()
        .describe('Return only the top N categories by total spending; omit to return all categories.'),
    }),
  });
}
