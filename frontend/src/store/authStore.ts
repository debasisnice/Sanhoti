import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  lastActivityTime: number | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateActivityTime: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      isMember: false,
      lastActivityTime: null,
      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isAdmin: user.role === UserRole.ADMIN,
          isMember: user.role === UserRole.MEMBER || user.role === UserRole.ADMIN,
          lastActivityTime: Date.now(),
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isAdmin: false,
          isMember: false,
          lastActivityTime: null,
        }),
      updateActivityTime: () =>
        set({
          lastActivityTime: Date.now(),
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

