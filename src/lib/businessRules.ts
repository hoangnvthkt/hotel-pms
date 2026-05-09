import type { FolioItem, RoomStatus, UserRole } from '@/types';
import { hasPermission } from '@/features/auth/rbac';

export const allowedRoomTransitions: Record<RoomStatus, RoomStatus[]> = {
  vacant_clean: ['occupied', 'out_of_order', 'blocked'],
  occupied: ['vacant_dirty', 'occupied_dirty'],
  occupied_dirty: ['occupied_clean'],
  occupied_clean: ['occupied_dirty', 'vacant_dirty'],
  vacant_dirty: ['inspected', 'out_of_order'],
  inspected: ['vacant_clean', 'vacant_dirty'],
  out_of_order: ['vacant_dirty'],
  blocked: ['vacant_clean'],
};

export function canTransitionRoomStatus(from: RoomStatus, to: RoomStatus): boolean {
  return allowedRoomTransitions[from]?.includes(to) ?? false;
}

export function isRoomSellable(status: RoomStatus): boolean {
  return status === 'vacant_clean' || status === 'inspected';
}

export function calculateFolioBalance(items: Pick<FolioItem, 'type' | 'amount'>[]): number {
  return items.reduce((sum, item) => sum + (item.type === 'debit' ? item.amount : -item.amount), 0);
}

export function canCheckoutWithBalance(balance: number, settlementMode: 'paid' | 'city_ledger', role?: UserRole): boolean {
  if (balance <= 0) return true;
  if (settlementMode !== 'city_ledger') return false;
  return role === 'admin' || role === 'manager' || hasPermission(role, 'payments:finalize');
}
