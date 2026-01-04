import { ExpenseDataHelper } from '../data/ExpenseDataHelper.js';
import { Expense } from '../models/types.js';

export class ExpenseService {
  private expenseDataHelper: ExpenseDataHelper;

  constructor() {
    this.expenseDataHelper = new ExpenseDataHelper();
  }

  async getAllExpenses(): Promise<Expense[]> {
    return this.expenseDataHelper.findAll();
  }

  async getExpenseById(id: string): Promise<Expense | null> {
    return this.expenseDataHelper.findById(id);
  }

  async getExpensesByEvent(eventId: string): Promise<Expense[]> {
    return this.expenseDataHelper.findByEventId(eventId);
  }

  async createExpense(data: {
    eventId?: string;
    title: string;
    description?: string;
    amount: number;
    category: string;
    date: string;
    receiptUrl?: string;
    createdBy: string;
  }): Promise<Expense> {
    return this.expenseDataHelper.create(data);
  }

  async updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt' | 'createdBy'>>): Promise<Expense | null> {
    return this.expenseDataHelper.update(id, updates);
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenseDataHelper.delete(id);
  }

  async getTotalByEvent(eventId: string): Promise<number> {
    return this.expenseDataHelper.getTotalByEvent(eventId);
  }

  async getTotalByCategory(category: string): Promise<number> {
    return this.expenseDataHelper.getTotalByCategory(category);
  }
}


