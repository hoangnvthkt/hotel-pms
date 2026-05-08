import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { mockUsers, mockCredentials } from '@/mock/users';
import type { User } from '@/types';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('pms_user');
    if (saved) setUser(JSON.parse(saved));
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 600));
    const cred = mockCredentials[email];
    if (!cred || cred.password !== password) return false;
    const found = mockUsers.find(u => u.id === cred.userId);
    if (!found) return false;
    setUser(found);
    localStorage.setItem('pms_user', JSON.stringify(found));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('pms_user');
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
