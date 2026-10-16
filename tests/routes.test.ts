import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', 'src', 'app');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? routeFiles(p) : /\.tsx$/.test(name) ? [p] : [];
  });
}

describe('routes', () => {
  it('every route file has a default export (an empty file still typechecks)', () => {
    const files = routeFiles(APP);
    expect(files.length).toBeGreaterThan(8);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).toMatch(/export default function \w+/);
  });
});
