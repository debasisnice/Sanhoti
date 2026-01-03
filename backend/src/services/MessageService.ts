import { MessageDataHelper } from '../data/MessageDataHelper.js';
import { Message } from '../models/types.js';

export class MessageService {
  private messageDataHelper: MessageDataHelper;

  constructor() {
    this.messageDataHelper = new MessageDataHelper();
  }

  async getAllMessages(): Promise<Message[]> {
    return this.messageDataHelper.findAll();
  }

  async getMessageById(id: string): Promise<Message | null> {
    return this.messageDataHelper.findById(id);
  }

  async getMessagesByUserId(userId: string): Promise<Message[]> {
    return this.messageDataHelper.findByUserId(userId);
  }

  async createMessage(data: {
    first_name: string;
    last_name: string;
    email_address: string;
    phone_number?: string;
    message: string;
    user_id?: string;
  }): Promise<Message> {
    return this.messageDataHelper.create({
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email_address,
      phone: data.phone_number,
      message: data.message,
      userId: data.user_id,
      read: false,
    });
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messageDataHelper.delete(id);
  }
}

