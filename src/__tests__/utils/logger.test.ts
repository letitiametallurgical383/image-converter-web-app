import { LogLevel, logger } from "@utils/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Logger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("logs debug messages", () => {
    logger.setMinLevel(LogLevel.DEBUG);
    logger.debug("test debug message", { key: "value" });
    expect(consoleDebugSpy).toHaveBeenCalled();
  });

  it("logs info messages", () => {
    logger.setMinLevel(LogLevel.INFO);
    logger.info("test info message", { key: "value" });
    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  it("logs warn messages", () => {
    logger.setMinLevel(LogLevel.WARN);
    logger.warn("test warn message", { key: "value" });
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("logs error messages", () => {
    logger.setMinLevel(LogLevel.ERROR);
    logger.error("test error message", { key: "value" });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("respects minimum log level", () => {
    logger.setMinLevel(LogLevel.WARN);
    logger.debug("should not log");
    logger.info("should not log");
    logger.warn("should log");
    logger.error("should log");

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("includes context in log output", () => {
    logger.setMinLevel(LogLevel.INFO);
    const context = { userId: 123, action: "convert" };
    logger.info("test message", context);

    expect(consoleInfoSpy).toHaveBeenCalled();
    const call = consoleInfoSpy.mock.calls[0];
    expect(call[0]).toContain("test message");
    expect(call[0]).toContain(JSON.stringify(context));
  });

  it("includes error in log output", () => {
    logger.setMinLevel(LogLevel.ERROR);
    const error = new Error("test error");
    logger.error("error occurred", { key: "value" }, error);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const call = consoleErrorSpy.mock.calls[0];
    expect(call[1]).toBe(error);
  });

  it("supports custom handlers", () => {
    const customHandler = vi.fn();
    logger.addHandler(customHandler);
    logger.setMinLevel(LogLevel.INFO);

    logger.info("test message", { key: "value" });

    expect(customHandler).toHaveBeenCalled();
    const entry = customHandler.mock.calls[0][0];
    expect(entry.level).toBe(LogLevel.INFO);
    expect(entry.message).toBe("test message");
    expect(entry.context).toEqual({ key: "value" });
  });

  it("catches and logs to console.error when a custom handler throws (line 61)", () => {
    const throwingHandler = vi.fn().mockImplementation(() => {
      throw new Error("handler failure");
    });
    logger.addHandler(throwingHandler);
    logger.setMinLevel(LogLevel.INFO);

    expect(() => logger.info("trigger")).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Logger handler failed:",
      expect.any(Error),
    );
  });
});
