import { nextFrame, yieldToIdle } from "@utils/idle";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("yieldToIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses requestIdleCallback if available", async () => {
    const originalRic = globalThis.requestIdleCallback;
    const ricMock = vi.fn((cb) => {
      setTimeout(cb, 0);
      return 1;
    });
    globalThis.requestIdleCallback =
      ricMock as unknown as typeof globalThis.requestIdleCallback;

    let resolved = false;
    const p = yieldToIdle(42).then(() => {
      resolved = true;
    });

    expect(ricMock).toHaveBeenCalled();
    const ricCall = ricMock.mock.calls[0] as unknown as [
      IdleRequestCallback,
      IdleRequestOptions,
    ];
    expect(ricCall[1]).toEqual({ timeout: 42 });

    vi.runAllTimers();
    await p;
    expect(resolved).toBe(true);

    globalThis.requestIdleCallback = originalRic;
  });

  it("falls back to setTimeout if requestIdleCallback is not available", async () => {
    const originalRic = (
      globalThis as {
        requestIdleCallback?: typeof globalThis.requestIdleCallback;
      }
    ).requestIdleCallback;
    (
      globalThis as {
        requestIdleCallback?: typeof globalThis.requestIdleCallback;
      }
    ).requestIdleCallback = undefined;

    const setTimeSpy = vi.spyOn(globalThis, "setTimeout");

    let resolved = false;
    const p = yieldToIdle().then(() => {
      resolved = true;
    });

    expect(setTimeSpy).toHaveBeenCalled();

    vi.runAllTimers();
    await p;
    expect(resolved).toBe(true);

    (
      globalThis as {
        requestIdleCallback?: typeof globalThis.requestIdleCallback;
      }
    ).requestIdleCallback = originalRic;
  });
});

describe("nextFrame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses requestAnimationFrame", async () => {
    const originalRaf = globalThis.requestAnimationFrame;
    const rafMock = vi.fn((cb) => {
      setTimeout(cb, 0);
      return 1;
    });
    globalThis.requestAnimationFrame =
      rafMock as unknown as typeof globalThis.requestAnimationFrame;

    let resolved = false;
    const p = nextFrame().then(() => {
      resolved = true;
    });

    expect(rafMock).toHaveBeenCalled();

    vi.runAllTimers();
    await p;
    expect(resolved).toBe(true);

    globalThis.requestAnimationFrame = originalRaf;
  });
});
