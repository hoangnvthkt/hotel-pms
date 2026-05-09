import { describe, expect, it } from 'vitest';
import { calculateFolioBalance, canCheckoutWithBalance, canTransitionRoomStatus, isRoomSellable } from './businessRules';

describe('business rules', () => {
  it('allows only valid room status transitions', () => {
    expect(canTransitionRoomStatus('vacant_clean', 'occupied')).toBe(true);
    expect(canTransitionRoomStatus('occupied', 'vacant_clean')).toBe(false);
    expect(canTransitionRoomStatus('out_of_order', 'vacant_dirty')).toBe(true);
  });

  it('keeps occupied and unavailable rooms out of sellable inventory', () => {
    expect(isRoomSellable('vacant_clean')).toBe(true);
    expect(isRoomSellable('inspected')).toBe(true);
    expect(isRoomSellable('occupied')).toBe(false);
    expect(isRoomSellable('out_of_order')).toBe(false);
    expect(isRoomSellable('blocked')).toBe(false);
  });

  it('calculates folio debit minus credit balance', () => {
    expect(calculateFolioBalance([
      { type: 'debit', amount: 1_000_000 },
      { type: 'debit', amount: 250_000 },
      { type: 'credit', amount: 600_000 },
    ])).toBe(650_000);
  });

  it('blocks checkout with positive balance unless moved to city ledger by authorized roles', () => {
    expect(canCheckoutWithBalance(100_000, 'paid', 'receptionist')).toBe(false);
    expect(canCheckoutWithBalance(100_000, 'city_ledger', 'receptionist')).toBe(false);
    expect(canCheckoutWithBalance(100_000, 'city_ledger', 'accountant')).toBe(true);
    expect(canCheckoutWithBalance(0, 'paid', 'receptionist')).toBe(true);
  });
});
