import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { AuthService } from '../services/AuthService.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        email_address, 
        password, 
        first_name, 
        last_name, 
        phone_number,
        address1,
        address2,
        city,
        state,
        zip,
        country
      } = req.body;

      // Validate mandatory fields
      if (!email_address || !password || !first_name || !last_name || !phone_number) {
        res.status(400).json({ error: 'Missing required fields: email_address, password, first_name, last_name, and phone_number are required' });
        return;
      }

      const result = await this.authService.register({
        email_address,
        password,
        first_name,
        last_name,
        phone_number,
        address1,
        address2,
        city,
        state,
        zip,
        country,
      });

      res.status(201).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      res.status(400).json({ error: message });
    }
  }

  async login(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, email_address, password } = req.body;
      const emailToUse = email_address || email;

      if (!emailToUse || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const result = await this.authService.login(emailToUse, password);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.status(401).json({ error: message });
    }
  }

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await this.authService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }

  async getCommitteeMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const members = await this.authService.getCommitteeMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch committee members' });
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await this.authService.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
  }

  async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      // Remove fields that shouldn't be updated
      delete updates.user_id;
      delete updates.password_hash;
      delete updates.created_at;
      delete updates.updated_at;
      delete updates.id;
      delete updates.password;
      
      const user = await this.authService.updateUser(userId, updates);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.json(user);
    } catch (error: any) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  }

  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { 
        email_address, 
        password, 
        first_name, 
        last_name, 
        phone_number,
        address1,
        address2,
        city,
        state,
        zip,
        country,
        user_type,
        member_type,
        is_active
      } = req.body;

      // Validate mandatory fields
      if (!email_address || !password || !first_name || !last_name || !phone_number) {
        res.status(400).json({ error: 'Missing required fields: email_address, password, first_name, last_name, and phone_number are required' });
        return;
      }

      const result = await this.authService.createUser({
        email_address,
        password,
        first_name,
        last_name,
        phone_number,
        address1,
        address2,
        city,
        state,
        zip,
        country,
        user_type: user_type || 'user',
        member_type: member_type || 'member',
        is_active: is_active !== undefined ? is_active : true,
      });

      res.status(201).json(result);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      res.status(400).json({ error: message });
    }
  }
}

