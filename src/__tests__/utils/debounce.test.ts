import { debounce, throttle } from "@utils/debounce";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does not call the function before wait period", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the function once after wait period", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("resets timer when called repeatedly (only last call fires)", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced("a");
    debounced("b");
    debounced("c");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("calls again after subsequent invocation after wait", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("throttle", () => {
  it("calls the function immediately on first invocation", async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled("first");
    await new Promise((r) => setTimeout(r, 60));
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("does not call again within the interval", async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("fires trailing call after interval expires", async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled("a");
    throttled("b");
    await new Promise((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("b");
  });

  it("updates trailing call arguments without creating new timeout if one exists", async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled("first");
    throttled("second");
    throttled("third");

    await new Promise((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("third");
  });
});
