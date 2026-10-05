import { useSyncExternalStore } from 'react';

/** Tailwind's `sm` breakpoint: tablets and wider get the full panels; phones get them folded. */
const WIDE = '(min-width: 640px)';

const subscribe = (onChange: () => void) => {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** Wider than a phone: tracks the window, so turning a tablet or resizing switches layouts. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => typeof matchMedia !== 'function' || matchMedia(WIDE).matches);
}
