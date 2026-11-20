import { useRef } from 'react';

export type FocusClaim = {
  /** True while the item at `index` should ask for focus: the first item, until anything in the group was focused. */
  prefer: (index: number) => boolean;
  /** Call when any item in the group gains focus. */
  claim: () => void;
};

/**
 * One-shot initial focus for a list on Android TV.
 *
 * `hasTVPreferredFocus` asks for focus whenever the view mounts. A virtualised list unmounts its
 * first item when it scrolls far away and mounts it again on the way back, so a plain
 * `hasTVPreferredFocus={index === 0}` pulls focus to the top of the list in the middle of
 * scrolling. With a claim, the first item asks only until the group has been focused once.
 */
export function createFocusClaim(enabled: boolean): FocusClaim {
  let claimed = false;
  return {
    prefer: (index) => enabled && !claimed && index === 0,
    claim: () => {
      claimed = true;
    },
  };
}

/** `createFocusClaim` kept for the lifetime of the component. */
export function useFocusClaim(enabled: boolean): FocusClaim {
  const ref = useRef<{ enabled: boolean; claim: FocusClaim } | null>(null);
  if (!ref.current || ref.current.enabled !== enabled) ref.current = { enabled, claim: createFocusClaim(enabled) };
  return ref.current.claim;
}
