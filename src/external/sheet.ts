import type { ExternalKind } from './apps';

export type SheetRequest = {
  kind: ExternalKind;
  url: string;
  title: string;
  /** Present for players: play in Vispar's own player. */
  playInternal?: () => void;
};

type Listener = (r: SheetRequest | null) => void;
let listener: Listener | null = null;

export function openExternalSheet(r: SheetRequest) {
  listener?.(r);
}
export function closeExternalSheet() {
  listener?.(null);
}
export function setSheetListener(l: Listener | null) {
  listener = l;
}
