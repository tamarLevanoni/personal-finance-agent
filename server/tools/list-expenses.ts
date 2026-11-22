import { tool } from 'ai';
import type { Expense } from '../agent/types';
import type { ExpenseFilterSchema } from './expense-filter-schema';
import { filterExpenses, type ExpenseFilters } from './filter-expenses';

export function listExpenses(
  expenses: Expense[],
  filters: ExpenseFilters = {}
) {
  const matchingExpenses = filterExpenses(expenses, filters)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalCount = matchingExpenses.length;

  return { expenses: matchingExpenses, totalCount };
}

export function createListExpensesTool(filters: ExpenseFilterSchema) {
  return tool({
    description: 'List all matching individual transactions, ordered by date from oldest to newest. Use for requests to show expenses or transactions, including transactions above an amount. Returns the complete matching list and totalCount. Omit filters to retrieve all transactions.',
    inputSchema: filters,
  });
}
