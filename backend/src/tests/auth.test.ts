import { describe, it, expect } from 'vitest';
import { AuthService } from '../services/AuthService.js';

/**
 * These tests write through DatabaseHelper, which src/tests/setup.ts redirects
 * at a temp copy of backend/data. Emails are randomised anyway, so repeated
 * runs cannot collide on the "user already exists" check.
 */
const uniqueEmail = (): string =>
  `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

function newUser() {
  return {
    email_address: uniqueEmail(),
    password: 'password123',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '9495550100',
  };
}

describe('AuthService', () => {
  it('should register a new user', async () => {
    const authService = new AuthService();
    const userData = newUser();

    const result = await authService.register(userData);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(userData.email_address);
    // `UserRole` in types.ts declares 'member', but the value actually stored
    // and put into the JWT is user_type, which is only ever 'admin' or 'user'.
    // See the RBAC note in CLAUDE.md — assert the real values, not the enum.
    expect(result.user.role).toBe('member');
    expect(result.user.userType).toBe('user');
  });

  it('should not register duplicate email', async () => {
    const authService = new AuthService();
    const userData = newUser();

    await authService.register(userData);
    await expect(authService.register(userData)).rejects.toThrow('User already exists');
  });

  it('should login with valid credentials', async () => {
    const authService = new AuthService();
    const userData = newUser();

    await authService.register(userData);
    const result = await authService.login(userData.email_address, userData.password);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe(userData.email_address);
  });

  it('should not login with invalid credentials', async () => {
    const authService = new AuthService();
    await expect(
      authService.login('invalid@example.com', 'wrongpassword')
    ).rejects.toThrow('Invalid credentials');
  });

  it('should not login with a valid email but the wrong password', async () => {
    const authService = new AuthService();
    const userData = newUser();
    await authService.register(userData);

    await expect(
      authService.login(userData.email_address, 'not-the-password')
    ).rejects.toThrow('Invalid credentials');
  });
});

describe('AuthService.getCommitteeMembers', () => {
  it('exposes only name and role — never contact details', async () => {
    const authService = new AuthService();
    const members = await authService.getCommitteeMembers();

    // This endpoint is public and unauthenticated. It previously spread the
    // whole user record, publishing officers' home addresses, emails and phone
    // numbers. Assert the shape so that cannot silently come back.
    for (const member of members) {
      expect(Object.keys(member).sort()).toEqual(['firstName', 'lastName', 'role']);
    }
  });
});
