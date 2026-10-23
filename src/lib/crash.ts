/** Plain text for a crash report the user can paste into an issue. Pure, so it is unit tested. */

const MAX_MESSAGE = 600;
const MAX_STACK_LINES = 8;

export type CrashInfo = { name?: string; message?: string; stack?: string };

export function describeCrash(error: unknown, context: { platform: string; version: string }): string {
  const e = (error && typeof error === 'object' ? error : { message: String(error ?? '') }) as CrashInfo;
  const message = (e.message ?? '').toString().trim().slice(0, MAX_MESSAGE) || '(no message)';
  const stack = (e.stack ?? '')
    .toString()
    .split('\n')
    .slice(1, 1 + MAX_STACK_LINES)
    .map((l) => l.trim())
    .filter(Boolean);
  return [
    `Vispar ${context.version || '?'} (${context.platform || '?'})`,
    `${e.name || 'Error'}: ${message}`,
    ...(stack.length ? ['', ...stack] : []),
  ].join('\n');
}
