import { resolveLifecycleDays } from '../lifecycle';

describe('resolveLifecycleDays', () => {
  it('defaults to suspend=3, delete=7 when unset', () => {
    expect(resolveLifecycleDays({})).toEqual({ suspendDays: 3, deleteDays: 7 });
  });

  it('reads operator-configured values', () => {
    expect(resolveLifecycleDays({ auto_suspend_days: '5', auto_delete_days: '14' }))
      .toEqual({ suspendDays: 5, deleteDays: 14 });
  });

  it('clamps delete to suspend+1 when delete <= suspend (never delete before suspend)', () => {
    expect(resolveLifecycleDays({ auto_suspend_days: '7', auto_delete_days: '7' }))
      .toEqual({ suspendDays: 7, deleteDays: 8 });
    expect(resolveLifecycleDays({ auto_suspend_days: '10', auto_delete_days: '3' }))
      .toEqual({ suspendDays: 10, deleteDays: 11 });
  });

  it('falls back to defaults for non-numeric / non-positive input', () => {
    expect(resolveLifecycleDays({ auto_suspend_days: 'abc', auto_delete_days: '0' }))
      .toEqual({ suspendDays: 3, deleteDays: 7 });
    expect(resolveLifecycleDays({ auto_suspend_days: '-2' }))
      .toEqual({ suspendDays: 3, deleteDays: 7 });
  });
});
