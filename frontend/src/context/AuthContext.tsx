'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setToken, removeToken } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role: string;
  wallet_balance: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  sessionMessage: null,
  clearSessionMessage: () => {},
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  // ── Logout (clears client state + server session + cookie) ─────────────────
  const logout = useCallback(async (message?: string) => {
    // Best-effort server-side session + cookie invalidation
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    removeToken(); // clear in-memory flag
    setUser(null);
    if (message) setSessionMessage(message);
  }, []);

  // ── Fetch user profile ────────────────────────────────────────────────────
  // Always calls the server — the httpOnly cookie is sent automatically.
  // SESSION_EXPIRED is silent: no toast — login modal handles re-auth on next action.
  const fetchProfile = useCallback(async () => {
    try {
      const data = await api('/user/profile');
      setUser(data.user as User);
      setToken('__cookie__'); // mark in-memory flag so getToken() returns truthy
    } catch (err: any) {
      removeToken();
      setUser(null);
      if (err?.status === 401 && err?.code === 'SESSION_KICKED') {
        setSessionMessage('เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
      }
      // SESSION_EXPIRED / generic 401 / network / 5xx: silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Always run on mount — server returns 401 if not logged in (no cookie)
  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (username: string, password: string) => {
    // Server sets auth_token httpOnly cookie in the Set-Cookie response header
    await api('/auth/login', { method: 'POST', body: { username, password } });
    setSessionMessage(null);
    await fetchProfile(); // fetchProfile calls setToken() on success
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
      login,
      logout,
      refresh: fetchProfile,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
