import { describe, expect, it } from 'vitest';

import { describeCrash } from '@/lib/crash';

const ctx = { platform: 'web', version: '2.3.0' };

describe('describeCrash', () => {
  it('names the app, platform, error and the first stack frames', () => {
    const e = new Error('Maximum update depth exceeded');
    e.name = 'Invariant Violation';
    const text = describeCrash(e, ctx);
    expect(text.split('\n')[0]).toBe('Vispar 2.3.0 (web)');
    expect(text).toContain('Invariant Violation: Maximum update depth exceeded');
  });

  it('survives missing fields and non-Error values', () => {
    expect(describeCrash(undefined, ctx)).toContain('(no message)');
    expect(describeCrash('plain string', ctx)).toContain('plain string');
    expect(describeCrash({}, { platform: '', version: '' })).toContain('Vispar ? (?)');
  });

  it('trims huge messages and keeps only a few stack lines', () => {
    const e = new Error('x'.repeat(5000));
    e.stack = ['Error', ...Array.from({ length: 50 }, (_, i) => `  at frame${i}`)].join('\n');
    const lines = describeCrash(e, ctx).split('\n');
    expect(lines[1]!.length).toBeLessThan(640);
    expect(lines.filter((l) => l.startsWith('at frame')).length).toBe(8);
  });
});
