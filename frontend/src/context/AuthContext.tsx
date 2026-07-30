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

/**
 * `initialUser` comes from the root layout, which reads the httpOnly session
 * cookie and resolves the profile before the response is sent. With it, the
 * member card renders its final contents in the first paint instead of sitting
 * collapsed until /auth/session answers - that gap was moving everything below
 * it in the sidebar. `loading` therefore starts false whenever the server has
 * already answered the question.
 *
 * The client still revalidates once on mount, which is what catches a session
 * kicked from another device between the render and the hydration.
 */
export function AuthProvider({
  children,
  initialUser = null,
  seeded = false,
}: {
  children: ReactNode;
  initialUser?: User | null;
  /** True when the server ran the session lookup, whatever its answer was. */
  seeded?: boolean;
}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!seeded);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  // Keep getToken() truthy from the first render for a seeded session, so
  // anything gating on it does not briefly believe the visitor is anonymous.
  if (initialUser && typeof window !== 'undefined') setToken('__cookie__');

  // ── Logout (clears client state + server session + cookie) ─────────────────
  const logout = useCallback(async (message?: string) => {
    // Best-effort server-side session + cookie invalidation
    api('/auth/logout', { method: 'POST' }).catch(() => {});
    removeToken(); // clear in-memory flag
    setUser(null);
    if (message) setSessionMessage(message);
  }, []);

  // ── Fetch user profile ────────────────────────────────────────────────────
  // Calls /auth/session, not /user/profile: it answers 200 with `user: null` for
  // a visitor who is not logged in, where /user/profile answered 401. The cookie
  // is httpOnly, so this call has to happen on every page load whether or not
  // there is a session, and a 401 on each anonymous load showed up as a console
  // error. SESSION_EXPIRED stays silent - the login modal handles re-auth on the
  // next action.
  const fetchProfile = useCallback(async () => {
    try {
      const data = await api('/auth/session');
      if (data.user) {
        setUser(data.user as User);
        setToken('__cookie__'); // mark in-memory flag so getToken() returns truthy
      } else {
        removeToken();
        setUser(null);
        if (data.code === 'SESSION_KICKED') {
          setSessionMessage('เซสชันถูกยกเลิก: มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
        }
      }
    } catch {
      // Network or 5xx only now. Treat as logged out, silently.
      removeToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
