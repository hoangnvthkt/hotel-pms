import { describe, expect, it } from 'vitest';
import { canAccessPath } from './rbac';

describe('route rbac', () => {
  it('keeps account page available to any authenticated role through protected route', () => {
    expect(canAccessPath('hk_staff', '/account')).toBe(true);
    expect(canAccessPath('receptionist', '/account')).toBe(true);
  });

  it('keeps settings restricted to management roles', () => {
    expect(canAccessPath('admin', '/settings')).toBe(true);
    expect(canAccessPath('manager', '/settings')).toBe(true);
    expect(canAccessPath('receptionist', '/settings')).toBe(false);
  });

  it('allows access when any assigned role has the route permission', () => {
    expect(canAccessPath(['accountant', 'receptionist'], '/guests')).toBe(true);
    expect(canAccessPath(['accountant', 'receptionist'], '/cashiering')).toBe(true);
  });
});
