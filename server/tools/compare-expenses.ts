import { tool } from 'ai';
import { z } from 'zod';
import type { Expense } from '../agent/types';
import { calculateExpenseStats } from './calculate-expense-stats';
import type { ExpenseFilterSchema } from './expense-filter-schema';
import { filterExpenses, type ExpenseFilters } from './filter-expenses';

interface CompareExpensesInput {
  first: ExpenseFilters;
  second: ExpenseFilters;
  operation: 'sum' | 'mean' | 'median';
  groupBy?: 'category';
}

function compareValues(
  first: ReturnType<typeof calculateExpenseStats>,
  second: ReturnType<typeof calculateExpenseStats>
) {
  const firstValue = first.value;
  const secondValue = second.value;
  const counts = { firstCount: first.count, secondCount: second.count };

  if (firstValue === null || secondValue === null) {
    return {
      firstValue, secondValue, ...counts,
      difference: null,
      percentageChange: null,
      direction: 'not-comparable' as const,
    };
  }

  const firstCents = Math.round(firstValue * 100);
  const secondCents = Math.round(secondValue * 100);
  const differenceCents = secondCents - firstCents;

  return {
    firstValue, secondValue, ...counts,
    difference: differenceCents / 100,
    percentageChange: firstCents === 0
      ? null
      : Math.round(differenceCents / Math.abs(firstCents) * 10000) / 100,
    direction: differenceCents > 0 ? 'increase' : differenceCents < 0 ? 'decrease' : 'unchanged',
  };
}

export function compareExpenses(expenses: Expense[], input: CompareExpensesInput) {
  const first = filterExpenses(expenses, input.first);
  const second = filterExpenses(expenses, input.second);
  const { operation } = input;

  if (input.groupBy === 'category') {
    const categories = [...new Set([...first, ...second].map(expense => expense.category))];
    const comparisons = categories.map(category => ({
      category,
      ...compareValues(
        calculateExpenseStats(first.filter(expense => expense.category === category), { operation }),
        calculateExpenseStats(second.filter(expense => expense.category === category), { operation })
      ),
    })).sort((a, b) => (a.category ?? '').localeCompare(b.category ?? ''));

    return { operation, comparisons };
  }

  return {
    operation,
    comparison: compareValues(
      calculateExpenseStats(first, { operation }),
      calculateExpenseStats(second, { operation })
    ),
  };
}

export function createCompareExpensesTool(filters: ExpenseFilterSchema) {
  return tool({
    description: 'Compare two expense selections using sum, mean, or median, optionally per category. All arithmetic is done in code: returns both values and counts, difference (second minus first), percentage change relative to the absolute first value, and direction from first to second. Use for comparison questions instead of calculating differences yourself. A zero first value gives a null percentage; empty mean/median selections are not comparable. Categories present on only one side are included.',
    inputSchema: z.object({
      first: filters.describe('The baseline selection. Include all its filters; use an empty object for all history.'),
      second: filters.describe('The selection to compare against the baseline. Include all its filters independently.'),
      operation: z.enum(['sum', 'mean', 'median']).default('sum')
        .describe('Compare total spending, average transaction amount, or median transaction amount.'),
      groupBy: z.enum(['category']).optional()
        .describe('Set to category for one comparison per category; omit for one overall comparison.'),
    }),
  });
}
