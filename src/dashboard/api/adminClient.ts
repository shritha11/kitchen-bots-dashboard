import { auth } from '../config/firebase';

/**
 * Centralized authenticated fetch client for Kitchen Bots Admin Dashboard
 */

export function getApiBaseUrl(): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
      return (import.meta.env.VITE_API_URL as string).trim().replace(/\/+$/, '');
    }
    if (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) {
      return (process.env.VITE_API_URL as string).trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  return 'https://kitchen-bots-api.workofcharan.workers.dev';
}

/**
 * Retrieves the active Firebase user ID token or stored session token
 */
export async function getAuthToken(): Promise<string | null> {
  // 1. Wait for Firebase Auth initialization if auth instance is ready
  try {
    if (auth && typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
  } catch {
    // Ignore authStateReady error
  }

  // 2. Try currently active Firebase Auth user
  try {
    if (auth && auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token && typeof token === 'string' && token.trim() !== '') {
        return token.trim();
      }
    }
  } catch {
    // Ignore Firebase auth error
  }

  // 3. Fallback to stored session token from localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('kb_auth_token');
      if (storedToken && typeof storedToken === 'string' && storedToken !== 'undefined' && storedToken !== 'null' && storedToken.trim() !== '') {
        return storedToken.trim();
      }
    }
  } catch {
    // Ignore storage read error
  }

  return null;
}

export interface AdminFetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function adminFetch<T = any>(endpoint: string, options: AdminFetchOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});

  // Set Authorization header if not explicitly provided
  if (!headers.has('Authorization')) {
    const token = await getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed && parsed.message) {
        errorMessage = parsed.message;
      }
    } catch {
      if (errorBody) errorMessage = errorBody;
    }
    const err = new Error(`[adminFetch Error ${res.status}] ${path}: ${errorMessage}`);
    (err as any).status = res.status;
    (err as any).endpoint = path;
    throw err;
  }

  const json = await res.json();
  return json;
}
