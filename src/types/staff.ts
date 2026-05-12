export type UserRole =
  | 'admin'
  | 'manager'
  | 'receptionist'
  | 'hk_supervisor'
  | 'hk_staff'
  | 'accountant';

export interface StaffProfile {
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

export type StaffStatus = 'active' | 'inactive';

export interface RoleAssignment {
  profile_id: string;
  role: UserRole;
}

export interface InviteStaffPayload {
  email: string;
  full_name: string;
  phone?: string;
  roles: UserRole[];
}
