import { StorageError } from "@core/errors";
import { createJsonStorage } from "@data/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("createJsonStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const makeStorage = () =>
    createJsonStorage<{ value: number }>("test-key", (raw) => {
      if (typeof raw !== "object" || raw === null || !("value" in raw))
        throw new Error("invalid");
      return raw as { value: number };
    });

  it("returns null when key does not exist", () => {
    const storage = makeStorage();
    expect(storage.read()).toBeNull();
  });

  it("writes and reads back a value correctly", () => {
    const storage = makeStorage();
    storage.write({ value: 42 });
    expect(storage.read()).toEqual({ value: 42 });
  });

  it("overwrites existing value on write", () => {
    const storage = makeStorage();
    storage.write({ value: 1 });
    storage.write({ value: 99 });
    expect(storage.read()?.value).toBe(99);
  });

  it("returns null when stored data is corrupted (invalid JSON)", () => {
    localStorage.setItem("test-key", "not-valid-json{{");
    const storage = makeStorage();
    expect(storage.read()).toBeNull();
  });

  it("returns null when stored data fails validation", () => {
    localStorage.setItem("test-key", JSON.stringify({ wrong: "shape" }));
    const storage = makeStorage();
    expect(storage.read()).toBeNull();
  });

  it("clears the key from localStorage", () => {
    const storage = makeStorage();
    storage.write({ value: 10 });
    storage.clear();
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("throws StorageError when write to localStorage is rejected", () => {
    const failingStorage = createJsonStorage<{ value: number }>(
      "quota-key",
      (raw) => {
        if (typeof raw !== "object" || raw === null || !("value" in raw))
          throw new Error("invalid");
        return raw as { value: number };
      },
    );

    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("QuotaExceededError");
        },
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      },
      configurable: true,
      writable: true,
    });

    try {
      expect(() => failingStorage.write({ value: 5 })).toThrow(StorageError);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it("throws StorageError with unknown message when write throws non-Error (line 29)", () => {
    const storage = makeStorage();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {
          throw "StringError";
        },
        removeItem: () => {},
        clear: () => {},
        length: 0,
        key: () => null,
      },
      configurable: true,
      writable: true,
    });

    try {
      expect(() => storage.write({ value: 5 })).toThrow(/unknown/);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it("does not throw when clear() and localStorage.removeItem throws", () => {
    const storage = makeStorage();
    const originalLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {
          throw new DOMException("SecurityError");
        },
        clear: () => {},
        length: 0,
        key: () => null,
      },
      configurable: true,
      writable: true,
    });
    try {
      expect(() => storage.clear()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });
});
