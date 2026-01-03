import { User } from '../models/types.js';

// Transform backend User (snake_case) to frontend User (camelCase)
export function transformUserForFrontend(user: User): any {
  return {
    id: user.user_id,
    userId: user.user_id,
    email: user.email_address,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone_number,
    address1: user.address1,
    address2: user.address2,
    city: user.city,
    state: user.state,
    zip: user.zip,
    country: user.country,
    role: user.user_type === 'admin' ? 'admin' : 'member',
    userType: user.user_type,
    memberType: user.member_type,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

// Transform frontend User (camelCase) to backend User (snake_case)
export function transformUserForBackend(data: any): Partial<User> {
  return {
    first_name: data.first_name || data.firstName,
    last_name: data.last_name || data.lastName,
    phone_number: data.phone_number || data.phoneNumber || data.phone,
    email_address: data.email_address || data.emailAddress || data.email,
    address1: data.address1,
    address2: data.address2,
    city: data.city,
    state: data.state,
    zip: data.zip,
    country: data.country,
    password_hash: data.password_hash || data.passwordHash,
    user_type: data.user_type || data.userType || 'user',
    member_type: data.member_type || data.memberType || 'member',
    is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true),
  };
}

