import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ExpenseService } from '../services/ExpenseService.js';

export class ExpenseController {
  private expenseService: ExpenseService;

  constructor() {
    this.expenseService = new ExpenseService();
  }

  async getAllExpenses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const expenses = await this.expenseService.getAllExpenses();
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }

  async getExpenseById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expense = await this.expenseService.getExpenseById(id);
      if (!expense) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expense' });
    }
  }

  async getExpensesByEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const expenses = await this.expenseService.getExpensesByEvent(eventId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }

  async createExpense(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { eventId, title, description, amount, category, date, receiptUrl } = req.body;

      if (!title || amount === undefined || !category || !date) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const expense = await this.expenseService.createExpense({
        eventId,
        title,
        description,
        amount: parseFloat(amount),
        category,
        date,
        receiptUrl,
        createdBy: req.user.userId,
      });

      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create expense' });
    }
  }

  async updateExpense(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (updates.amount !== undefined) {
        updates.amount = parseFloat(updates.amount);
      }

      const expense = await this.expenseService.updateExpense(id, updates);
      if (!expense) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }

      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update expense' });
    }
  }

  async deleteExpense(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.expenseService.deleteExpense(id);
      if (!success) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }

      res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }

  async getEventTotal(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      const total = await this.expenseService.getTotalByEvent(eventId);
      res.json({ eventId, total });
    } catch (error) {
      res.status(500).json({ error: 'Failed to calculate total' });
    }
  }

  async getCategoryTotal(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const total = await this.expenseService.getTotalByCategory(category);
      res.json({ category, total });
    } catch (error) {
      res.status(500).json({ error: 'Failed to calculate total' });
    }
  }
}

