import { z } from 'zod';
import { ExpenseCategory } from '../agent/types';

export function createExpenseFilterSchema() {
  return z.object({
    category: z.enum(ExpenseCategory).optional()
      .describe('An available category; omit to include all categories.'),
    vendor: z.string().optional()
      .describe('The exact vendor name; omit to include all vendors.'),
    startDate: z.iso.date().optional()
      .describe('Inclusive start date in YYYY-MM-DD format; omit for no lower bound.'),
    endDate: z.iso.date().optional()
      .describe('Exclusive end date in YYYY-MM-DD format; omit for no upper bound.'),
    excludeOutliers: z.boolean().optional()
      .describe('Exclude unusually high transactions: amounts above the mean plus two standard deviations. Detection uses the category/vendor/date selection before amount conditions are applied. Defaults to false.'),
    amount: z.object({
      eq: z.number().optional().describe('Transaction amount equals this value (=).'),
      gt: z.number().optional().describe('Transaction amount is strictly greater than this value (>).'),
      gte: z.number().optional().describe('Transaction amount is greater than or equal to this value (>=).'),
      lt: z.number().optional().describe('Transaction amount is strictly less than this value (<).'),
      lte: z.number().optional().describe('Transaction amount is less than or equal to this value (<=).'),
    }).optional().describe('Filters on each transaction amount, not the final total. All supplied conditions must match; combine lower and upper bounds for a range.'),
  });
}

export type ExpenseFilterSchema = ReturnType<typeof createExpenseFilterSchema>;
