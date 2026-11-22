import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Expense } from '../server/agent/types';
import { loadExpensesFromCSV } from '../server/utils/csv-loader';
import { calculateExpenseStats } from '../server/tools/calculate-expense-stats';
import { compareExpenses } from '../server/tools/compare-expenses';
import { groupExpensesByCategory } from '../server/tools/group-expenses-by-category';
import { listExpenses } from '../server/tools/list-expenses';

test('calculations and category totals match the exercise reference data', () => {
  const expenses = loadExpensesFromCSV('server/expenses_data/expenses_2024-2025.csv');
  const november = { startDate: '2025-11-01', endDate: '2025-12-01' };

  assert.equal(calculateExpenseStats(expenses, { ...november, category: 'groceries', operation: 'sum' }).value, 288.75);
  assert.equal(calculateExpenseStats(expenses, { category: 'dining', operation: 'mean' }).value, 161.16);
  assert.equal(calculateExpenseStats(expenses, { category: 'dining', operation: 'median', excludeOutliers: true }).value, 81.16);
  assert.deepEqual(groupExpensesByCategory(expenses, november).map(({ category, total }) => ({ category, total })), [
    { category: 'groceries', total: 288.75 },
    { category: 'utilities', total: 148.9 },
    { category: 'entertainment', total: 79.41 },
    { category: 'dining', total: 72.69 },
    { category: 'transportation', total: 34.94 },
    { category: 'subscriptions', total: 27.03 },
  ]);
  assert.equal(groupExpensesByCategory(expenses, { ...november, topN: 3 }).length, 3);
});

test('shared filters select transactions and can exclude outliers', () => {
  const expenses: Expense[] = [
    { date: '2025-11-01', amount: 50, category: 'groceries', vendor: 'Market' },
    { date: '2025-11-30', amount: 100, category: 'groceries', vendor: 'Market' },
    { date: '2025-12-01', amount: 200, category: 'groceries', vendor: 'Market' },
    { date: '2025-11-01', amount: 75, category: 'dining', vendor: 'Cafe' },
  ];
  assert.equal(listExpenses(expenses).totalCount, 4);
  assert.deepEqual(listExpenses(expenses, {
    category: 'groceries', vendor: 'Market',
    startDate: '2025-11-01', endDate: '2025-12-01', amount: { gt: 50 },
  }).expenses, [expenses[1]]);

  const withOutlier = [...Array.from({ length: 9 }, () => expenses[0]), { ...expenses[0], amount: 1000 }];
  assert.equal(listExpenses(withOutlier, { amount: { gt: 100 } }).totalCount, 1);
  assert.equal(listExpenses(withOutlier, { excludeOutliers: true, amount: { gt: 100 } }).totalCount, 0);
});

test('comparisons calculate differences and percentages, including per category', () => {
  const expenses: Expense[] = [
    { date: '2025-09-01', amount: 0.1, category: 'groceries', vendor: 'Market' },
    { date: '2025-09-02', amount: 0.2, category: 'groceries', vendor: 'Market' },
    { date: '2025-10-01', amount: 0.4, category: 'groceries', vendor: 'Market' },
    { date: '2025-10-02', amount: 20, category: 'dining', vendor: 'Cafe' },
  ];
  const first = { startDate: '2025-09-01', endDate: '2025-10-01' };
  const second = { startDate: '2025-10-01', endDate: '2025-11-01' };
  const result = compareExpenses(expenses, {
    first: { ...first, category: 'groceries' },
    second: { ...second, category: 'groceries' }, operation: 'sum',
  });
  assert.deepEqual(result.comparison, {
    firstValue: 0.3, secondValue: 0.4, firstCount: 2, secondCount: 1,
    difference: 0.1, percentageChange: 33.33, direction: 'increase',
  });
  const grouped = compareExpenses(expenses, { first, second, operation: 'sum', groupBy: 'category' });
  assert.equal(grouped.comparisons?.find(row => row.category === 'groceries')?.difference, 0.1);
  const dining = grouped.comparisons?.find(row => row.category === 'dining');
  assert.equal(dining?.difference, 20);
  assert.equal(dining?.percentageChange, null);
});
