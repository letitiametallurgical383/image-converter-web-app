export function yieldToIdle(timeoutMs = 32): Promise<void> {
  return new Promise((resolve) => {
    const anyWindow = globalThis as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    };
    if (typeof anyWindow.requestIdleCallback === "function") {
      anyWindow.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
