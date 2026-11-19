// store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicUrl?: string | null;
  isVerified?: boolean;
  instagramAccount?: { id: string; username: string; isActive: boolean } | null;
  subscription?: { status: string; currentPeriodEnd: string; plan: { name: string; dmLimit: number; campaignLimit: number } } | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isFetched: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isFetched: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      logout: async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        set({ user: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      fetchMe: async () => {
        set({ isLoading: true, isFetched: false });
        try {
          const res = await authApi.me();
          set({ user: res.data.data.user, isAuthenticated: true, isFetched: true });
        } catch (err) {
          set({ user: null, isAuthenticated: false, isFetched: true });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
