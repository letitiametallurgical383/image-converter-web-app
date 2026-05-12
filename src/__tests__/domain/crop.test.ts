import { computeCropRect } from "@domain/crop";
import { describe, expect, it } from "vitest";

describe("computeCropRect", () => {
  it("returns full image when all crops are 0%", () => {
    const rect = computeCropRect(800, 600, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(rect).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600, dw: 800, dh: 600 });
  });

  it("crops symmetric 10% from all sides of a 1000x1000 image", () => {
    const rect = computeCropRect(1000, 1000, {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
    expect(rect.sx).toBe(100);
    expect(rect.sy).toBe(100);
    expect(rect.sw).toBe(800);
    expect(rect.sh).toBe(800);
    expect(rect.dw).toBe(rect.sw);
    expect(rect.dh).toBe(rect.sh);
  });

  it("crops left and right asymmetrically", () => {
    const rect = computeCropRect(100, 100, {
      top: 0,
      right: 20,
      bottom: 0,
      left: 10,
    });
    expect(rect.sx).toBe(10);
    expect(rect.sw).toBe(70);
  });

  it("crops top and bottom asymmetrically", () => {
    const rect = computeCropRect(100, 200, {
      top: 25,
      right: 0,
      bottom: 25,
      left: 0,
    });
    expect(rect.sy).toBe(50);
    expect(rect.sh).toBe(100);
  });

  it("ensures minimum width of 1 when crop is near-total", () => {
    const rect = computeCropRect(100, 100, {
      top: 0,
      right: 49,
      bottom: 0,
      left: 49,
    });
    expect(rect.sw).toBeGreaterThanOrEqual(1);
  });

  it("ensures minimum height of 1 when crop is near-total", () => {
    const rect = computeCropRect(100, 100, {
      top: 49,
      right: 0,
      bottom: 49,
      left: 0,
    });
    expect(rect.sh).toBeGreaterThanOrEqual(1);
  });

  it("floors the source x/y coordinates", () => {
    const rect = computeCropRect(100, 100, {
      top: 3,
      right: 0,
      bottom: 0,
      left: 3,
    });
    expect(Number.isInteger(rect.sx)).toBe(true);
    expect(Number.isInteger(rect.sy)).toBe(true);
  });

  it("dw and dh always equal sw and sh", () => {
    const rect = computeCropRect(1920, 1080, {
      top: 5,
      right: 10,
      bottom: 5,
      left: 10,
    });
    expect(rect.dw).toBe(rect.sw);
    expect(rect.dh).toBe(rect.sh);
  });
});
