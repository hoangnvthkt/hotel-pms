import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { mockUsers, mockCredentials } from '@/mock/users';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/types';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isMockMode: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthCtx | null>(null);

const validRoles: UserRole[] = ['admin', 'manager', 'receptionist', 'hk_supervisor', 'hk_staff', 'accountant'];
const isMockMode = import.meta.env.VITE_USE_MOCKS === 'true' || !isSupabaseConfigured || !supabase;

function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && validRoles.includes(role as UserRole);
}

async function loadSupabaseUser(authUserId: string, email?: string): Promise<User | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, property_id, full_name, email, phone, is_active, profile_roles(role)')
    .eq('id', authUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as {
    id: string;
    property_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    is_active: boolean | null;
    profile_roles?: Array<{ role?: string }> | null;
  };

  if (row.is_active === false) throw new Error('Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.');

  const roleName = row.profile_roles?.map(pr => pr.role).find(isUserRole);
  if (!roleName) throw new Error('Tài khoản chưa được phân quyền. Liên hệ quản trị viên.');

  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.full_name,
    email: row.email ?? email ?? '',
    phone: row.phone ?? undefined,
    role: roleName,
    isActive: row.is_active ?? true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isMockMode) {
          const saved = localStorage.getItem('pms_user');
          if (saved) setUser(JSON.parse(saved));
          return;
        }

        const { data } = await supabase!.auth.getSession();
        const sessionUser = data.session?.user;
        if (!sessionUser) return;
        const profile = await loadSupabaseUser(sessionUser.id, sessionUser.email);
        if (!cancelled) setUser(profile);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được phiên đăng nhập');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    if (isMockMode || !supabase) {
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (!session?.user) {
          setUser(null);
          return;
        }
        const profile = await loadSupabaseUser(session.user.id, session.user.email);
        setUser(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không đồng bộ được trạng thái đăng nhập');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      if (isMockMode) {
        await new Promise(r => setTimeout(r, 400));
        const cred = mockCredentials[email];
        if (!cred || cred.password !== password) return false;
        const found = mockUsers.find(u => u.id === cred.userId);
        if (!found) return false;
        setUser(found);
        localStorage.setItem('pms_user', JSON.stringify(found));
        return true;
      }

      const { data, error: signInError } = await supabase!.auth.signInWithPassword({ email, password });
      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Đăng nhập không thành công');
        return false;
      }
      const profile = await loadSupabaseUser(data.user.id, data.user.email);
      setUser(profile);
      return Boolean(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công');
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem('pms_user');
    if (!isMockMode && supabase) await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, login, logout, isLoading, isMockMode, error }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
