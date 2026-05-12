import { getMimeForFormat, usesQuality } from "@domain/formats";
import { describe, expect, it } from "vitest";

describe("usesQuality", () => {
  it("returns true for jpeg", () => expect(usesQuality("jpeg")).toBe(true));
  it("returns true for webp", () => expect(usesQuality("webp")).toBe(true));
  it("returns true for avif", () => expect(usesQuality("avif")).toBe(true));
  it("returns false for png", () => expect(usesQuality("png")).toBe(false));
});

describe("getMimeForFormat", () => {
  it("returns correct MIME for jpeg", () =>
    expect(getMimeForFormat("jpeg")).toBe("image/jpeg"));
  it("returns correct MIME for webp", () =>
    expect(getMimeForFormat("webp")).toBe("image/webp"));
  it("returns correct MIME for avif", () =>
    expect(getMimeForFormat("avif")).toBe("image/avif"));
  it("returns correct MIME for png", () =>
    expect(getMimeForFormat("png")).toBe("image/png"));
});
