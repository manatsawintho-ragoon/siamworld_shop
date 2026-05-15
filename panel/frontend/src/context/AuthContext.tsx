'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import api from '@/lib/api';

const INACTIVITY_MS = 40 * 60 * 1000; // 40 minutes — must match server-side policy

interface PanelUser {
  id: number;
  email: string;
  displayName: string;
  role: 'customer' | 'admin';
  walletBalance: number;
  lineNotifyToken?: string | null;
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
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logout (clears client state + server session + cookie) ─────────────────
  const logout = useCallback(async (message?: string) => {
    // Best-effort server-side session + cookie invalidation (cookie sent via withCredentials)
    api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    if (message) setSessionMessage(message);
  }, []);

  // ── Client-side inactivity timer ───────────────────────────────────────────
  // userRef avoids stale closure without making logout/resetInactivityTimer re-create on user change
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (userRef.current) {
        logout('เซสชันหมดอายุ: ไม่มีการใช้งานนานเกิน 40 นาที กรุณาเข้าสู่ระบบใหม่');
      }
    }, INACTIVITY_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    const onActivity = () => { if (userRef.current) resetInactivityTimer(); };
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [resetInactivityTimer]);

  // ── Fetch user profile ─────────────────────────────────────────────────────
  // Always calls the server — panel_auth cookie is sent automatically (withCredentials).
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.sessionCode) {
        setUser(null);
        if (err?.sessionCode === 'SESSION_KICKED') {
          setSessionMessage('เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
        } else if (err?.sessionCode === 'SESSION_EXPIRED') {
          setSessionMessage('เซสชันหมดอายุ: ไม่มีการใช้งานนานเกิน 40 นาที กรุณาเข้าสู่ระบบใหม่');
        }
      }
      // Network/5xx errors: leave user as null, no alarming message
    }
  }, []);

  // Always run on mount — server returns 401 if no valid panel_auth cookie
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  // ── Login ─────────────────────────────────────────────────────────────────
  // Server sets panel_auth httpOnly cookie in Set-Cookie response header
  const login = async (email: string, password: string, captchaToken?: string) => {
    const { data } = await api.post('/api/auth/login', { email, password, captchaToken });
    setUser(data.user);
    setSessionMessage(null);
    resetInactivityTimer();
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
