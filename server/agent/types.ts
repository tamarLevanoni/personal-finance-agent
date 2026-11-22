export enum ExpenseCategory {
  Groceries = 'groceries',
  Dining = 'dining',
  Utilities = 'utilities',
  Entertainment = 'entertainment',
  Transportation = 'transportation',
  Subscriptions = 'subscriptions',
  Health = 'health',
  Shopping = 'shopping',
}

export interface Expense {
  date: string;
  amount: number;
  category: string | null;
  vendor: string;
}
