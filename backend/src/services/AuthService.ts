import { UserDataHelper } from '../data/UserDataHelper.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';
import { User } from '../models/types.js';
import { transformUserForFrontend } from '../utils/userTransform.js';

/**
 * The only committee fields exposed publicly: exactly what the /committee
 * page renders. Deliberately not derived from `User`, so adding a field to
 * the user record cannot silently widen a public endpoint.
 */
export interface CommitteeMemberPublic {
  firstName: string;
  lastName: string;
  role: string;
}

export class AuthService {
  private userDataHelper: UserDataHelper;

  constructor() {
    this.userDataHelper = new UserDataHelper();
  }

  async register(data: {
    email_address: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }): Promise<{ user: any; token: string }> {
    // Check if user exists
    const existing = await this.userDataHelper.findByEmail(data.email_address);
    if (existing) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const password_hash = await hashPassword(data.password);

    // Create user with defaults
    const user = await this.userDataHelper.create({
      first_name: data.first_name,
      last_name: data.last_name,
      phone_number: data.phone_number,
      email_address: data.email_address,
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      password_hash: password_hash,
      user_type: 'user',
      member_type: 'member',
      is_active: true,
    });

    // Generate token (using user_type as role for compatibility)
    const token = generateToken({
      userId: user.user_id,
      email: user.email_address,
      role: user.user_type,
    });

    // Transform user to frontend format
    return { user: transformUserForFrontend(user), token };
  }

  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    const user = await this.userDataHelper.findByEmail(email);
    if (!user || !user.is_active) {
      throw new Error('Invalid credentials');
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = generateToken({
      userId: user.user_id,
      email: user.email_address,
      role: user.user_type,
    });

    // Transform user to frontend format
    return { user: transformUserForFrontend(user), token };
  }

  async getUserById(userId: string): Promise<any | null> {
    const user = await this.userDataHelper.findById(userId);
    if (!user) return null;
    return transformUserForFrontend(user);
  }

  /**
   * Committee members for the public /committee page.
   *
   * This feeds an unauthenticated endpoint, so it returns only the three fields
   * the page actually renders. It previously spread the whole user record via
   * `transformUserForFrontend`, which meant `GET /api/committee` served each
   * officer's home address, personal email and phone number to anyone who asked
   * — none of it visible on the page, all of it one curl away.
   *
   * Add a field here only if the public page genuinely displays it.
   */
  async getCommitteeMembers(): Promise<CommitteeMemberPublic[]> {
    const committeeRoles = ['President', 'Secretary', 'Treasurer', 'Cultural Director'];
    const committeeMembers: CommitteeMemberPublic[] = [];

    for (const role of committeeRoles) {
      const users = await this.userDataHelper.findByMemberType(role);
      if (users.length > 0) {
        // Take the first active user with this member_type
        const user = users[0];
        committeeMembers.push({
          firstName: user.first_name ?? '',
          lastName: user.last_name ?? '',
          role,
        });
      }
    }

    return committeeMembers;
  }

  async getAllUsers(): Promise<any[]> {
    const users = await this.userDataHelper.findAll();
    return users.map(user => transformUserForFrontend(user));
  }

  async createUser(data: {
    email_address: string;
    password: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    user_type?: string;
    member_type?: string;
    is_active?: boolean;
  }): Promise<any> {
    // Check if user exists
    const existing = await this.userDataHelper.findByEmail(data.email_address);
    if (existing) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const password_hash = await hashPassword(data.password);

    // Create user with provided or default values
    const user = await this.userDataHelper.create({
      first_name: data.first_name,
      last_name: data.last_name,
      phone_number: data.phone_number,
      email_address: data.email_address,
      address1: data.address1,
      address2: data.address2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      password_hash: password_hash,
      user_type: data.user_type || 'user',
      member_type: data.member_type || 'member',
      is_active: data.is_active !== undefined ? data.is_active : true,
    });

    // Transform user to frontend format (no token needed for admin-created users)
    return transformUserForFrontend(user);
  }

  async updateUser(userId: string, updates: {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    email_address?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    user_type?: string;
    member_type?: string;
    is_active?: boolean;
  }): Promise<any> {
    const user = await this.userDataHelper.update(userId, updates);
    if (!user) return null;
    return transformUserForFrontend(user);
  }

  async deleteUser(userId: string): Promise<boolean> {
    return await this.userDataHelper.delete(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userDataHelper.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await this.userDataHelper.update(userId, { password_hash: newPasswordHash });
    return true;
  }
}

