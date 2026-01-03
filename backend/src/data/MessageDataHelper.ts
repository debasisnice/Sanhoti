import { DatabaseHelper } from './DatabaseHelper.js';
import { Message } from '../models/types.js';

export class MessageDataHelper extends DatabaseHelper {
  private readonly filename = 'messages.json';

  async findAll(): Promise<Message[]> {
    return this.readFile<Message>(this.filename);
  }

  async findById(id: string): Promise<Message | null> {
    const messages = await this.findAll();
    return messages.find(m => m.id === id) || null;
  }

  async findByUserId(userId: string): Promise<Message[]> {
    const messages = await this.findAll();
    return messages.filter(m => m.userId === userId);
  }

  async create(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const messages = await this.findAll();
    const newMessage: Message = {
      ...message,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };
    messages.push(newMessage);
    this.writeFile(this.filename, messages);
    return newMessage;
  }

  async delete(id: string): Promise<boolean> {
    const messages = await this.findAll();
    const filtered = messages.filter(m => m.id !== id);
    if (filtered.length === messages.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }
}

