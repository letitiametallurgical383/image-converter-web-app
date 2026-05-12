import { formatBytes, formatDuration, formatPercent } from "@utils/format";
import { describe, expect, it } from "vitest";

describe("formatBytes", () => {
  it("formats bytes as B for small values", () =>
    expect(formatBytes(512)).toBe("512 B"));
  it("formats bytes as KB at 1024", () =>
    expect(formatBytes(1024)).toBe("1.0 KB"));
  it("formats 1.5 KB correctly", () =>
    expect(formatBytes(1536)).toBe("1.5 KB"));
  it("formats 10KB+ without decimal", () =>
    expect(formatBytes(10 * 1024)).toBe("10 KB"));
  it("formats MB correctly", () =>
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB"));
  it("formats GB correctly", () =>
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB"));
  it("returns — for NaN", () => expect(formatBytes(NaN)).toBe("—"));
  it("returns — for negative value", () => expect(formatBytes(-1)).toBe("—"));
  it("returns — for Infinity", () => expect(formatBytes(Infinity)).toBe("—"));
});

describe("formatPercent", () => {
  it("formats 0.5 as 50% with 0 digits", () =>
    expect(formatPercent(0.5)).toBe("50%"));
  it("formats 0.123 with 1 digit", () =>
    expect(formatPercent(0.123, 1)).toBe("12.3%"));
  it("returns — for NaN", () => expect(formatPercent(NaN)).toBe("—"));
  it("handles 0%", () => expect(formatPercent(0)).toBe("0%"));
  it("handles 100%", () => expect(formatPercent(1)).toBe("100%"));
});

describe("formatDuration", () => {
  it("formats sub-second as ms", () =>
    expect(formatDuration(250)).toBe("250 ms"));
  it("formats exactly 1000ms as seconds", () =>
    expect(formatDuration(1000)).toBe("1.00 s"));
  it("formats 1500ms as 1.50 s", () =>
    expect(formatDuration(1500)).toBe("1.50 s"));
  it("returns — for NaN", () => expect(formatDuration(NaN)).toBe("—"));
  it("returns — for negative", () => expect(formatDuration(-1)).toBe("—"));
  it("formats 0ms", () => expect(formatDuration(0)).toBe("0 ms"));
});
