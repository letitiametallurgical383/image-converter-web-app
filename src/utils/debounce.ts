export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
): (...args: Args) => void {
  let handle: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn(...args);
    }, waitMs);
  };
}

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): (...args: Args) => void {
  let lastCall = 0;
  let trailing: Args | null = null;
  let handle: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    lastCall = performance.now();
    fn(...(trailing as Args));
    trailing = null;
    handle = null;
  };
  return (...args: Args) => {
    const now = performance.now();
    const remaining = intervalMs - (now - lastCall);
    if (remaining <= 0) {
      lastCall = now;
      fn(...args);
    } else {
      trailing = args;
      if (handle === null) {
        handle = setTimeout(flush, remaining);
      }
    }
  };
}
