import type { UserRole } from '@/types';

export interface AccountProfile {
  id: string;
  property_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_path?: string | null;
  avatar_url?: string;
  position_title?: string | null;
  is_active: boolean;
  roles: UserRole[];
  primaryRole: UserRole;
  created_at: string;
  updated_at?: string;
}

export interface UpdateMyProfileInput {
  full_name?: string;
  phone?: string | null;
  avatar_path?: string | null;
  position_title?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
