import type { UserRole } from '@/types';

export type Permission =
  | 'dashboard:view'
  | 'rooms:view'
  | 'rooms:manage'
  | 'bookings:view'
  | 'bookings:manage'
  | 'guests:view'
  | 'guests:manage'
  | 'guest_requests:manage'
  | 'reception:operate'
  | 'housekeeping:view'
  | 'housekeeping:assign'
  | 'housekeeping:update_own'
  | 'folio:view'
  | 'folio:charge'
  | 'payments:finalize'
  | 'cashiering:reconcile'
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
  'guest_requests:manage',
  'reception:operate',
  'housekeeping:view',
  'housekeeping:assign',
  'housekeeping:update_own',
  'folio:view',
  'folio:charge',
  'payments:finalize',
  'cashiering:reconcile',
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
    'guests:manage',
    'guest_requests:manage',
    'reception:operate',
    'housekeeping:view',
    'housekeeping:assign',
    'folio:view',
    'folio:charge',
    'cashiering:reconcile',
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
    'guest_requests:manage',
    'reception:operate',
    'folio:view',
    'folio:charge',
  ],
  hk_supervisor: ['rooms:view', 'guest_requests:manage', 'housekeeping:view', 'housekeeping:assign', 'housekeeping:update_own'],
  hk_staff: ['rooms:view', 'guest_requests:manage', 'housekeeping:view', 'housekeeping:update_own'],
  accountant: ['dashboard:view', 'guest_requests:manage', 'folio:view', 'payments:finalize', 'cashiering:reconcile', 'reports:view'],
};

export const routePermissions: Record<string, Permission> = {
  '/dashboard': 'dashboard:view',
  '/rooms': 'rooms:view',
  '/bookings': 'bookings:view',
  '/guests': 'guests:view',
  '/guest-requests': 'guest_requests:manage',
  '/reception': 'reception:operate',
  '/housekeeping': 'housekeeping:view',
  '/folio': 'folio:view',
  '/cashiering': 'cashiering:reconcile',
  '/night-audit': 'night_audit:run',
  '/reports': 'reports:view',
  '/settings': 'settings:manage',
};

type RoleInput = UserRole | UserRole[] | undefined;

function normalizeRoles(role: RoleInput): UserRole[] {
  if (!role) return [];
  return Array.isArray(role) ? role : [role];
}

export function hasPermission(role: RoleInput, permission: Permission): boolean {
  return normalizeRoles(role).some(r => rolePermissions[r]?.includes(permission) ?? false);
}

export function canAccessPath(role: RoleInput, path: string): boolean {
  const permission = routePermissions[path];
  if (!permission) return true;
  return hasPermission(role, permission);
}

export function firstAllowedPath(role: RoleInput): string {
  return Object.entries(routePermissions).find(([, permission]) => hasPermission(role, permission))?.[0] ?? '/login';
}
