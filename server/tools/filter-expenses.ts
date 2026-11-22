import type { Expense } from '../agent/types';
import { detectAnomalies } from '../utils/anomaly-helper';

const OUTLIER_THRESHOLD_MULTIPLIER = 2;

export interface ExpenseFilters {
  category?: string;
  vendor?: string;
  startDate?: string;
  endDate?: string;
  excludeOutliers?: boolean;
  amount?: {
    eq?: number;
    gt?: number;
    gte?: number;
    lt?: number;
    lte?: number;
  };
}

export function filterExpenses(
  expenses: Expense[],
  { category, vendor, startDate, endDate, excludeOutliers = false, amount = {} }: ExpenseFilters = {}
): Expense[] {
  // Dates use YYYY-MM-DD; include startDate and exclude endDate.
  let matchingExpenses = expenses.filter(expense => {
    if (category !== undefined && expense.category?.toLowerCase() !== category.toLowerCase()) return false;
    if (vendor !== undefined && expense.vendor.toLowerCase() !== vendor.toLowerCase()) return false;

    if (startDate !== undefined && expense.date < startDate) return false;
    if (endDate !== undefined && expense.date >= endDate) return false;

    return true;
  });

  // Detect outliers before amount filtering, so a high-amount-only selection
  // does not redefine unusually large transactions as normal.
  if (excludeOutliers) {
    const outliers = new Set(detectAnomalies(matchingExpenses, OUTLIER_THRESHOLD_MULTIPLIER));
    matchingExpenses = matchingExpenses.filter(expense => !outliers.has(expense));
  }

  return matchingExpenses.filter(expense => {
    if (amount.eq !== undefined && expense.amount !== amount.eq) return false;
    if (amount.gt !== undefined && expense.amount <= amount.gt) return false;
    if (amount.gte !== undefined && expense.amount < amount.gte) return false;
    if (amount.lt !== undefined && expense.amount >= amount.lt) return false;
    if (amount.lte !== undefined && expense.amount > amount.lte) return false;

    return true;
  });
}
