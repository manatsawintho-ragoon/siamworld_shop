'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';

interface PanelUser {
  id: number;
  email: string;
  displayName: string;
  role: 'customer' | 'admin';
  walletBalance: number;
  phone?: string | null;
  avatarUrl?: string | null;
}

interface AuthCtx {
  user: PanelUser | null;
  loading: boolean;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PanelUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  // ── Logout (clears client state + server session + cookie) ─────────────────
  const logout = useCallback(async (message?: string) => {
    // Best-effort server-side session + cookie invalidation (cookie sent via withCredentials)
    api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    if (message) setSessionMessage(message);
  }, []);

  // ── Fetch user profile ─────────────────────────────────────────────────────
  // Hits /auth/session rather than /auth/me: it answers 200 with `user: null`
  // for a signed-out visitor, where /auth/me answered 401. The panel_auth cookie
  // is httpOnly, so this runs on every page load whether or not there is a
  // session, and a 401 on each signed-out load showed up as a console error.
  // SESSION_EXPIRED stays a silent re-login - the login modal handles it.
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/session');
      setUser(data.user ?? null);
      if (data.sessionCode === 'SESSION_KICKED') {
        setSessionMessage('เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
      }
    } catch {
      // Network/5xx only now. Leave the user signed out, no alarming message.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // ── Login ─────────────────────────────────────────────────────────────────
  // Server sets panel_auth httpOnly cookie in Set-Cookie response header
  const login = async (email: string, password: string, captchaToken?: string) => {
    const { data } = await api.post('/api/auth/login', { email, password, captchaToken });
    setUser(data.user);
    setSessionMessage(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      sessionMessage,
      clearSessionMessage: () => setSessionMessage(null),
      login,
      logout,
      refreshUser,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}
