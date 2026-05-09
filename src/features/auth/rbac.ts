import type { UserRole } from '@/types';

export type Permission =
  | 'dashboard:view'
  | 'rooms:view'
  | 'rooms:manage'
  | 'bookings:view'
  | 'bookings:manage'
  | 'guests:view'
  | 'guests:manage'
  | 'reception:operate'
  | 'housekeeping:view'
  | 'housekeeping:assign'
  | 'housekeeping:update_own'
  | 'folio:view'
  | 'folio:charge'
  | 'payments:finalize'
  | 'night_audit:run'
  | 'reports:view'
  | 'settings:manage';

const allPermissions: Permission[] = [
  'dashboard:view',
  'rooms:view',
  'rooms:manage',
  'bookings:view',
  'bookings:manage',
  'guests:view',
  'guests:manage',
  'reception:operate',
  'housekeeping:view',
  'housekeeping:assign',
  'housekeeping:update_own',
  'folio:view',
  'folio:charge',
  'payments:finalize',
  'night_audit:run',
  'reports:view',
  'settings:manage',
];

export const rolePermissions: Record<UserRole, Permission[]> = {
  admin: allPermissions,
  manager: [
    'dashboard:view',
    'rooms:view',
    'bookings:view',
    'bookings:manage',
    'guests:view',
    'reception:operate',
    'housekeeping:view',
    'housekeeping:assign',
    'folio:view',
    'folio:charge',
    'night_audit:run',
    'reports:view',
    'settings:manage',
  ],
  receptionist: [
    'dashboard:view',
    'rooms:view',
    'bookings:view',
    'bookings:manage',
    'guests:view',
    'guests:manage',
    'reception:operate',
    'folio:view',
    'folio:charge',
  ],
  hk_supervisor: ['rooms:view', 'housekeeping:view', 'housekeeping:assign', 'housekeeping:update_own'],
  hk_staff: ['rooms:view', 'housekeeping:view', 'housekeeping:update_own'],
  accountant: ['dashboard:view', 'folio:view', 'payments:finalize', 'reports:view'],
};

export const routePermissions: Record<string, Permission> = {
  '/dashboard': 'dashboard:view',
  '/rooms': 'rooms:view',
  '/bookings': 'bookings:view',
  '/guests': 'guests:view',
  '/reception': 'reception:operate',
  '/housekeeping': 'housekeeping:view',
  '/folio': 'folio:view',
  '/night-audit': 'night_audit:run',
  '/reports': 'reports:view',
  '/settings': 'settings:manage',
};

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function canAccessPath(role: UserRole | undefined, path: string): boolean {
  const permission = routePermissions[path];
  if (!permission) return true;
  return hasPermission(role, permission);
}

export function firstAllowedPath(role: UserRole | undefined): string {
  return Object.entries(routePermissions).find(([, permission]) => hasPermission(role, permission))?.[0] ?? '/login';
}
