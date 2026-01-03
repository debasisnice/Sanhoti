import { DatabaseHelper } from './DatabaseHelper.js';
import { Expense } from '../models/types.js';

export class ExpenseDataHelper extends DatabaseHelper {
  private readonly filename = 'expenses.json';

  async findAll(): Promise<Expense[]> {
    return this.readFile<Expense>(this.filename);
  }

  async findById(id: string): Promise<Expense | null> {
    const expenses = await this.findAll();
    return expenses.find(e => e.id === id) || null;
  }

  async findByEventId(eventId: string): Promise<Expense[]> {
    const expenses = await this.findAll();
    return expenses.filter(e => e.eventId === eventId);
  }

  async create(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const expenses = await this.findAll();
    const newExpense: Expense = {
      ...expense,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expenses.push(newExpense);
    this.writeFile(this.filename, expenses);
    return newExpense;
  }

  async update(id: string, updates: Partial<Expense>): Promise<Expense | null> {
    const expenses = await this.findAll();
    const index = expenses.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    expenses[index] = {
      ...expenses[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.writeFile(this.filename, expenses);
    return expenses[index];
  }

  async delete(id: string): Promise<boolean> {
    const expenses = await this.findAll();
    const filtered = expenses.filter(e => e.id !== id);
    if (filtered.length === expenses.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }

  async getTotalByEvent(eventId: string): Promise<number> {
    const expenses = await this.findByEventId(eventId);
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  async getTotalByCategory(category: string): Promise<number> {
    const expenses = await this.findAll();
    return expenses
      .filter(e => e.category === category)
      .reduce((sum, e) => sum + e.amount, 0);
  }
}

