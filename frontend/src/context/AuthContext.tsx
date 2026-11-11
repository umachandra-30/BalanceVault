import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface UserAccount {
  id: string;
  accountNumber: string;
  type: string;
  status: string;
  currency: string;
  balance: string;
}

export interface UserOnboarding {
  id: string;
  status: 'NOT_STARTED' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  documentType: string | null;
  documentNumberMasked: string | null;
  notes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'ACCOUNT_HOLDER' | 'AUDITOR';
  status: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  accounts?: UserAccount[];
  onboarding?: UserOnboarding | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, pass: string, role?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('bv_token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = async (): Promise<AuthUser | null> => {
    const activeToken = token || localStorage.getItem('bv_token');
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (!res.ok) {
        throw new Error('Session invalid');
      }

      const json = await res.json();
      if (json.success) {
        setUser(json.data);
        return json.data;
      }
      return null;
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem('bv_token');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email: string, pass: string): Promise<AuthUser> => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Login failed. Please verify credentials.');
    }

    setToken(json.data.accessToken);
    localStorage.setItem('bv_token', json.data.accessToken);
    setUser(json.data.user);

    // Refresh full profile including onboarding & accounts
    const fullUser = await refreshUser();
    return fullUser || json.data.user;
  };

  const register = async (fullName: string, email: string, pass: string, role = 'ACCOUNT_HOLDER'): Promise<AuthUser> => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password: pass, role }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      const details = json.error?.details
        ? ` (${json.error.details.map((d: any) => d.message).join(', ')})`
        : '';
      throw new Error((json.error?.message || 'Registration failed') + details);
    }

    setToken(json.data.accessToken);
    localStorage.setItem('bv_token', json.data.accessToken);
    setUser(json.data.user);

    const fullUser = await refreshUser();
    return fullUser || json.data.user;
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('bv_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

