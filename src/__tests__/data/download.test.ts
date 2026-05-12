import { downloadBlob } from "@data/download";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("downloadBlob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor element, sets attributes, clicks it, and cleans up", () => {
    const blob = new Blob(["hello"], { type: "text/plain" });

    const mockAnchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click: vi.fn(),
    };

    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(
        (() => {}) as unknown as typeof document.body.appendChild,
      );
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(
        (() => {}) as unknown as typeof document.body.removeChild,
      );

    downloadBlob(blob, "test.txt");

    expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.href).toBe("blob:mock-url");
    expect(mockAnchor.download).toBe("test.txt");
    expect(mockAnchor.rel).toBe("noopener");
    expect(mockAnchor.style.display).toBe("none");

    expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(mockAnchor);

    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:mock-url",
    );
  });
});
