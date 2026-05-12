import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { mockUsers, mockCredentials } from '@/mock/users';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/types';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
  resetAuthCache: () => void;
  isLoading: boolean;
  isMockMode: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthCtx | null>(null);

const validRoles: UserRole[] = ['admin', 'manager', 'receptionist', 'hk_supervisor', 'hk_staff', 'accountant'];
const isMockMode = import.meta.env.VITE_USE_MOCKS === 'true' || !isSupabaseConfigured || !supabase;
const authTimeoutMs = 10_000;

function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && validRoles.includes(role as UserRole);
}

function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = authTimeoutMs): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      err => {
        window.clearTimeout(timeout);
        reject(err);
      },
    );
  });
}

function clearCachedAuthState() {
  if (typeof window === 'undefined') return;

  const authKeyPattern = /^sb-.+-auth-token$/;
  const shouldRemove = (key: string) =>
    key === 'pms_user' ||
    key === 'supabase.auth.token' ||
    authKeyPattern.test(key);

  [window.localStorage, window.sessionStorage].forEach(storage => {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i);
      if (key && shouldRemove(key)) storage.removeItem(key);
    }
  });
}

async function loadAvatarUrl(path?: string | null): Promise<string | undefined> {
  if (!path || !supabase) return undefined;
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  if (error) return undefined;
  return data.signedUrl;
}

async function loadSupabaseUser(authUserId: string, email?: string): Promise<User | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, property_id, full_name, email, phone, avatar_path, position_title, is_active, profile_roles(role)')
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
    avatar_path?: string | null;
    position_title?: string | null;
    is_active: boolean | null;
    profile_roles?: Array<{ role?: string }> | null;
  };

  if (row.is_active === false) throw new Error('Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.');

  const roles = row.profile_roles?.map(pr => pr.role).filter(isUserRole) ?? [];
  const roleName = roles[0];
  if (!roleName) throw new Error('Tài khoản chưa được phân quyền. Liên hệ quản trị viên.');

  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.full_name,
    email: row.email ?? email ?? '',
    phone: row.phone ?? undefined,
    role: roleName,
    roles,
    avatarPath: row.avatar_path ?? undefined,
    avatarUrl: await loadAvatarUrl(row.avatar_path),
    positionTitle: row.position_title ?? undefined,
    isActive: row.is_active ?? true,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveUserFromSession = async (session: Session | null): Promise<User | null> => {
    const sessionUser = session?.user;
    if (!sessionUser) return null;
    return withTimeout(
      loadSupabaseUser(sessionUser.id, sessionUser.email),
      'Tải hồ sơ đăng nhập quá lâu. Vui lòng thử đăng nhập lại.',
    );
  };

  const applySession = async (session: Session | null): Promise<User | null> => {
    const profile = await resolveUserFromSession(session);
    setUser(profile);
    setError(null);
    return profile;
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      if (isMockMode) {
        const saved = localStorage.getItem('pms_user');
        const parsed = saved ? JSON.parse(saved) as User : null;
        setUser(parsed);
        return parsed;
      }

      const { data, error: sessionError } = await withTimeout(
        supabase!.auth.getSession(),
        'Phiên đăng nhập phản hồi quá lâu. Vui lòng thử đăng nhập lại.',
      );
      if (sessionError) throw sessionError;
      return applySession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được tài khoản');
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isMockMode) {
          const saved = localStorage.getItem('pms_user');
          if (saved) {
            const parsed = JSON.parse(saved) as User;
            if (!parsed.roles) parsed.roles = [parsed.role];
            setUser(parsed);
          }
          return;
        }

        const { data, error: sessionError } = await withTimeout(
          supabase!.auth.getSession(),
          'Phiên đăng nhập phản hồi quá lâu. Vui lòng thử đăng nhập lại.',
        );
        if (sessionError) throw sessionError;
        const profile = await resolveUserFromSession(data.session);
        if (!cancelled) {
          setUser(profile);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          setError(err instanceof Error ? err.message : 'Không tải được phiên đăng nhập');
        }
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;

      window.setTimeout(() => {
        if (cancelled) return;

        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setError(null);
          return;
        }

        void resolveUserFromSession(session).then(profile => {
          if (!cancelled) {
            setUser(profile);
            setError(null);
          }
        }).catch(err => {
          if (!cancelled) {
            setUser(null);
            setError(err instanceof Error ? err.message : 'Không đồng bộ được trạng thái đăng nhập');
          }
        });
      }, 0);
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
        const normalized = { ...found, roles: found.roles ?? [found.role] };
        setUser(normalized);
        localStorage.setItem('pms_user', JSON.stringify(normalized));
        return true;
      }

      const { data, error: signInError } = await withTimeout(
        supabase!.auth.signInWithPassword({ email, password }),
        'Đăng nhập phản hồi quá lâu. Vui lòng thử lại.',
      );
      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Đăng nhập không thành công');
        return false;
      }
      const profile = await withTimeout(
        loadSupabaseUser(data.user.id, data.user.email),
        'Tải hồ sơ sau đăng nhập quá lâu. Vui lòng thử lại.',
      );
      setUser(profile);
      setError(null);
      return Boolean(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công');
      return false;
    }
  };

  const resetAuthCache = () => {
    setUser(null);
    setError(null);
    clearCachedAuthState();
  };

  const logout = async () => {
    setUser(null);
    clearCachedAuthState();
    if (!isMockMode && supabase) {
      await withTimeout(supabase.auth.signOut(), 'Đăng xuất phản hồi quá lâu. Phiên local đã được xóa.').catch(() => undefined);
    }
  };

  return <AuthContext.Provider value={{ user, login, logout, refreshUser, resetAuthCache, isLoading, isMockMode, error }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
