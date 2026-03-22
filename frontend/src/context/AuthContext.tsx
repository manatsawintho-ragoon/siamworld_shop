'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, getToken, setToken, removeToken } from '@/lib/api';

interface User {
  id: number;
  username: string;
  role: string;
  wallet_balance: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const data = await api('/user/profile', { token });
      setUser(data.user as User);
    } catch (err: any) {
      // Only clear token on 401 (token invalid/expired)
      // For network errors, 429, 5xx — keep token and retry on next load
      if (err?.status === 401) {
        removeToken();
        setUser(null);
      }
      // Any other error: server temporarily down, rate limited, etc.
      // Don't remove the token — user is still logged in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (username: string, password: string) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setToken(data.token as string);
    await fetchProfile();
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
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
