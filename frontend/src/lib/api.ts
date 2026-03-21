// Use relative path so all API calls go through the Next.js proxy (fixes external access CORS)
const API_URL = '/api';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  [key: string]: T | boolean | string | undefined;
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Something went wrong');
  }
  return data;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}
