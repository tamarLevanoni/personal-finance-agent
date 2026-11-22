import type { ExpenseFilters } from '../tools/filter-expenses';
import type { compareExpenses } from '../tools/compare-expenses';
import type { FinanceToolResult } from '../tools';

type Comparison = NonNullable<ReturnType<typeof compareExpenses>['comparison']>;

const text = {
  sum: 'Total spending', mean: 'Average expense', median: 'Median expense',
  transactions: 'transactions', category: 'Category', vendor: 'Vendor', date: 'Date',
  amount: 'Amount', total: 'Total', count: 'Transaction count',
  all: 'All expenses across all history', from: 'From', until: 'Until (exclusive)',
  outliers: 'Excluding outliers', noData: 'No matching transactions', unavailable: 'Not defined',
  categories: 'Spending by category', comparison: 'Comparison',
  first: 'First selection', second: 'Second selection', value: 'Value',
  difference: 'Difference (second minus first)', percentage: 'Percentage change', direction: 'Direction',
  increase: 'Increase', decrease: 'Decrease', unchanged: 'Unchanged',
  noMatch: 'The request could not be matched to an available tool. Specify what to show or calculate, with a category or dates if needed.',
  partialError: 'Some operations failed. Only successful results are shown.',
};

// Values are inserted into Markdown tables and later converted to HTML.
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+!|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

function money(value: number | null): string {
  if (value === null) return text.noData;
  // The exercise data and reference answers use dollars.
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(value);
}

function categoryName(category: string | null): string {
  return escapeText(category ?? 'uncategorized');
}

function table(headers: string[], rows: string[][]): string {
  return [headers, headers.map(() => '---'), ...rows]
    .map(row => `| ${row.join(' | ')} |`).join('\n');
}

function filterDescription(filters: ExpenseFilters): string {
  const parts: string[] = [];
  if (filters.category !== undefined) parts.push(`${text.category}: ${categoryName(filters.category)}`);
  if (filters.vendor !== undefined) parts.push(`${text.vendor}: ${escapeText(filters.vendor)}`);
  if (filters.startDate !== undefined) parts.push(`${text.from}: ${filters.startDate}`);
  if (filters.endDate !== undefined) parts.push(`${text.until}: ${filters.endDate}`);
  const operators: Record<string, string> = { eq: '=', gt: '>', gte: '>=', lt: '<', lte: '<=' };
  for (const [operator, value] of Object.entries(filters.amount ?? {})) {
    if (value !== undefined) parts.push(`${text.amount} ${escapeText(operators[operator])} ${money(value)}`);
  }
  if (filters.excludeOutliers) parts.push(text.outliers);
  return parts.length === 0 ? text.all : parts.join('; ');
}

function comparisonValues(comparison: Comparison) {
  const directions: Record<string, string> = {
    increase: text.increase, decrease: text.decrease, unchanged: text.unchanged,
  };
  return {
    difference: comparison.difference === null ? text.unavailable : money(comparison.difference),
    percentage: comparison.percentageChange === null ? text.unavailable : `${comparison.percentageChange}%`,
    direction: directions[comparison.direction] ?? text.unavailable,
  };
}

export function formatToolResult(result: FinanceToolResult): string {
  switch (result.toolName) {
    case 'calculateExpenseStats': {
      const { output, input } = result;
      return `${filterDescription(input)}\n\n${text[output.operation]}: **${money(output.value)}**\n\n${text.count}: ${output.count}`;
    }
    case 'listExpenses': {
      const { output, input } = result;
      const heading = `${filterDescription(input)}\n\n${text.count}: ${output.totalCount}`;
      if (output.totalCount === 0) return `${heading}\n\n${text.noData}`;
      return `${heading}\n\n${table(
        [text.date, text.category, text.vendor, text.amount],
        output.expenses.map(expense => [
          expense.date, categoryName(expense.category),
          escapeText(expense.vendor), money(expense.amount),
        ])
      )}`;
    }
    case 'groupExpensesByCategory': {
      const { output, input } = result;
      const heading = `**${text.categories}**\n\n${filterDescription(input)}`;
      if (output.length === 0) return `${heading}\n\n${text.noData}`;
      return `${heading}\n\n${table(
        [text.category, text.total, text.count],
        output.map(row => [categoryName(row.category), money(row.total), String(row.count)])
      )}`;
    }
    case 'compareExpenses': {
      const { output, input } = result;
      const heading = `**${text.comparison}: ${text[output.operation]}**\n\n${text.first}: ${filterDescription(input.first)}\n\n${text.second}: ${filterDescription(input.second)}`;
      if (output.comparisons) {
        if (output.comparisons.length === 0) return `${heading}\n\n${text.noData}`;
        return `${heading}\n\n${table(
          [text.category, text.first, text.second, text.difference, text.percentage, text.direction],
          output.comparisons.map(row => {
            const formatted = comparisonValues(row);
            return [categoryName(row.category), money(row.firstValue),
              money(row.secondValue), formatted.difference, formatted.percentage, formatted.direction];
          })
        )}`;
      }
      const comparison = output.comparison;
      const formatted = comparisonValues(comparison);
      return `${heading}\n\n${table(
        [text.comparison, text.value, text.count],
        [[text.first, money(comparison.firstValue), String(comparison.firstCount)],
          [text.second, money(comparison.secondValue), String(comparison.secondCount)]]
      )}\n\n${text.difference}: **${formatted.difference}**\n\n${text.percentage}: ${formatted.percentage}\n\n${text.direction}: ${formatted.direction}`;
    }
  }
}

export function noToolMessage(): string {
  return text.noMatch;
}

export function partialFailureMessage(): string {
  return text.partialError;
}
