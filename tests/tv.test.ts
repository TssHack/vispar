import { describe, expect, it } from 'vitest';

import { createFocusClaim } from '@/lib/focusClaim';

describe('focus claim (one-shot initial focus on TV)', () => {
  it('prefers only the first item', () => {
    const c = createFocusClaim(true);
    expect(c.prefer(0)).toBe(true);
    expect(c.prefer(1)).toBe(false);
  });

  it('stops preferring once anything in the group was focused, so a remounted first item does not steal focus', () => {
    const c = createFocusClaim(true);
    c.claim();
    expect(c.prefer(0)).toBe(false);
  });

  it('never prefers when disabled (phones, web without ?tv=1)', () => {
    expect(createFocusClaim(false).prefer(0)).toBe(false);
  });
});
