import { DatabaseHelper } from './DatabaseHelper.js';
import { User } from '../models/types.js';

export class UserDataHelper extends DatabaseHelper {
  private readonly filename = 'users.json';

  async findAll(): Promise<User[]> {
    return this.readFile<User>(this.filename);
  }

  async findById(userId: string): Promise<User | null> {
    const users = await this.findAll();
    return users.find(u => u.user_id === userId) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const users = await this.findAll();
    return users.find(u => u.email_address.toLowerCase() === email.toLowerCase()) || null;
  }

  async create(user: Omit<User, 'user_id' | 'created_at' | 'updated_at'>): Promise<User> {
    const users = await this.findAll();
    
    // Generate unique 12-digit alphanumeric user_id
    let user_id: string;
    let exists = true;
    while (exists) {
      user_id = this.generate12DigitAlphanumericId();
      const existing = users.find(u => u.user_id === user_id);
      exists = existing !== undefined;
    }

    const newUser: User = {
      ...user,
      user_id: user_id!,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    users.push(newUser);
    this.writeFile(this.filename, users);
    return newUser;
  }

  async update(userId: string, updates: Partial<Omit<User, 'user_id' | 'created_at'>>): Promise<User | null> {
    const users = await this.findAll();
    const index = users.findIndex(u => u.user_id === userId);
    if (index === -1) return null;
    
    users[index] = {
      ...users[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.writeFile(this.filename, users);
    return users[index];
  }

  async delete(userId: string): Promise<boolean> {
    const users = await this.findAll();
    const filtered = users.filter(u => u.user_id !== userId);
    if (filtered.length === users.length) return false;
    this.writeFile(this.filename, filtered);
    return true;
  }

  async findByUserType(userType: string): Promise<User[]> {
    const users = await this.findAll();
    return users.filter(u => u.user_type === userType && u.is_active);
  }

  async findByMemberType(memberType: string): Promise<User[]> {
    const users = await this.findAll();
    return users.filter(u => u.member_type === memberType && u.is_active);
  }
}

