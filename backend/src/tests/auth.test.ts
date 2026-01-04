import { describe, it, expect } from 'vitest';
import { AuthService } from '../services/AuthService.js';
import { UserRole } from '../models/types.js';

describe('AuthService', () => {
  it('should register a new user', async () => {
    const authService = new AuthService();
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    const result = await authService.register(userData);
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(userData.email);
    expect(result.user.role).toBe(UserRole.MEMBER);
  });

  it('should not register duplicate email', async () => {
    const authService = new AuthService();
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    await authService.register(userData);
    await expect(authService.register(userData)).rejects.toThrow('User already exists');
  });

  it('should login with valid credentials', async () => {
    const authService = new AuthService();
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    await authService.register(userData);
    const result = await authService.login(userData.email, userData.password);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
  });

  it('should not login with invalid credentials', async () => {
    const authService = new AuthService();
    await expect(authService.login('invalid@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
  });
});


