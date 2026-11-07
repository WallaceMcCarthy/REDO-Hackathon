import { describe, expect, it } from 'vitest';
import { claimPendingSave, rememberPendingSave } from './SavedButton';

describe('claimPendingSave', () => {
  it('saves once for the tapped home after sign-in', () => {
    rememberPendingSave('h1', 0);
    expect(claimPendingSave('h2', false, 1000)).toBe(false);
    expect(claimPendingSave('h1', false, 1000)).toBe(true);
    expect(claimPendingSave('h1', false, 1000)).toBe(false);
  });
  it('does not toggle a home that is already saved', () => {
    rememberPendingSave('h1', 0);
    expect(claimPendingSave('h1', true, 1000)).toBe(false);
  });
  it('drops a stale tap', () => {
    rememberPendingSave('h1', 0);
    expect(claimPendingSave('h1', false, 10 * 60_000)).toBe(false);
  });
});
