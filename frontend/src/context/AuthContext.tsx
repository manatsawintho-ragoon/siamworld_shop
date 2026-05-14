'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api, setToken, removeToken, getToken } from '@/lib/api';

const INACTIVITY_MS = 40 * 60 * 1000; // 40 minutes — must match server-side policy

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
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logout (clears client state + server session + cookie) ─────────────────
  const logout = useCallback(async (message?: string) => {
    // Best-effort server-side session + cookie invalidation
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    removeToken(); // clear in-memory flag
    setUser(null);
    if (message) setSessionMessage(message);
  }, []);

  // ── Client-side inactivity timer ───────────────────────────────────────────
  // getToken() returns truthy while _sessionActive is true (in-memory flag)
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      if (getToken()) {
        logout('เซสชันหมดอายุ: ไม่มีการใช้งานนานเกิน 40 นาที กรุณาเข้าสู่ระบบใหม่');
      }
    }, INACTIVITY_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    const onActivity = () => {
      if (getToken()) resetInactivityTimer();
    };
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetInactivityTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [resetInactivityTimer]);

  // ── Fetch user profile ────────────────────────────────────────────────────
  // Always calls the server — the httpOnly cookie is sent automatically.
  // On 401, clears session state.
  const fetchProfile = useCallback(async () => {
    try {
      const data = await api('/user/profile');
      setUser(data.user as User);
      setToken('__cookie__'); // mark in-memory flag so getToken() returns truthy
    } catch (err: any) {
      removeToken();
      setUser(null);
      if (err?.status === 401) {
        if (err?.code === 'SESSION_KICKED') {
          setSessionMessage('เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
        } else if (err?.code === 'SESSION_EXPIRED') {
          setSessionMessage('เซสชันหมดอายุ: ไม่มีการใช้งานนานเกิน 40 นาที กรุณาเข้าสู่ระบบใหม่');
        }
        // Other 401s (no cookie / expired JWT): silently clear — user simply not logged in
      }
      // Network errors, 5xx: keep user null, no alarming message
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
      refresh: fetchProfile,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
