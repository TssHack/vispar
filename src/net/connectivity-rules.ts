/**
 * - checking: probe in flight
 * - online:   internet works and the catalog API answered
 * - offline:  no internet at all
 * - server:   internet works but the catalog API is unreachable
 */
export type NetStatus = 'checking' | 'online' | 'offline' | 'server';

export const REPORT_GAP_MS = 10_000;

/** Whether a failure report should start a probe: only while online, and at most once per gap. Pure for tests. */
export function shouldProbe(status: NetStatus, now: number, lastProbe: number, gap = REPORT_GAP_MS): boolean {
  return status === 'online' && now - lastProbe >= gap;
}
