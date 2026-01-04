import { Request, Response } from 'express';
import { MessageService } from '../services/MessageService.js';
import { AuthRequest } from '../middleware/auth.js';

export class MessageController {
  private messageService: MessageService;

  constructor() {
    this.messageService = new MessageService();
  }

  async createMessage(req: Request | AuthRequest, res: Response): Promise<void> {
    try {
      const { first_name, last_name, email_address, phone_number, message } = req.body;

      if (!first_name || !last_name || !email_address || !message) {
        res.status(400).json({ error: 'First name, last name, email address, and message are required' });
        return;
      }

      // If user is authenticated, include user_id
      const user_id = 'user' in req && req.user ? req.user.userId : undefined;

      const newMessage = await this.messageService.createMessage({
        first_name,
        last_name,
        email_address,
        phone_number,
        message,
        user_id,
      });

      res.status(201).json(newMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create message';
      res.status(500).json({ error: message });
    }
  }

  async getAllMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const messages = await this.messageService.getAllMessages();
      res.json(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch messages';
      res.status(500).json({ error: message });
    }
  }

  async getMessageById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const message = await this.messageService.getMessageById(id);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      res.json(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch message';
      res.status(500).json({ error: message });
    }
  }

  async getMyMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const messages = await this.messageService.getMessagesByUserId(req.user.userId);
      res.json(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch messages';
      res.status(500).json({ error: message });
    }
  }

  async deleteMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const success = await this.messageService.deleteMessage(id);
      if (!success) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }
      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete message';
      res.status(500).json({ error: message });
    }
  }
}


