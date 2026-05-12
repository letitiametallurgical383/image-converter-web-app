import {
  AppError,
  ConversionError,
  InvalidFileError,
  StorageError,
  toErrorMessage,
  UnsupportedFormatError,
  ValidationError,
} from "@core/errors";
import { describe, expect, it } from "vitest";

describe("AppError", () => {
  it("sets name, code, and message correctly", () => {
    const err = new AppError("E_TEST", "test message");
    expect(err.name).toBe("AppError");
    expect(err.code).toBe("E_TEST");
    expect(err.message).toBe("test message");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("InvalidFileError", () => {
  it("has correct code and name", () => {
    const err = new InvalidFileError("bad file");
    expect(err.code).toBe("E_INVALID_FILE");
    expect(err.name).toBe("InvalidFileError");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("UnsupportedFormatError", () => {
  it("has correct code and name", () => {
    const err = new UnsupportedFormatError("bad format");
    expect(err.code).toBe("E_UNSUPPORTED_FORMAT");
    expect(err.name).toBe("UnsupportedFormatError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("StorageError", () => {
  it("has correct code and name", () => {
    const err = new StorageError("storage failed");
    expect(err.code).toBe("E_STORAGE");
    expect(err.name).toBe("StorageError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ValidationError", () => {
  it("has correct code and name", () => {
    const err = new ValidationError("invalid value");
    expect(err.code).toBe("E_VALIDATION");
    expect(err.name).toBe("ValidationError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ConversionError", () => {
  it("has correct code and name", () => {
    const err = new ConversionError("conversion failed");
    expect(err.code).toBe("E_CONVERSION");
    expect(err.name).toBe("ConversionError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("toErrorMessage", () => {
  it("extracts message from AppError", () => {
    expect(toErrorMessage(new ValidationError("val err"))).toBe("val err");
  });

  it("extracts message from standard Error", () => {
    expect(toErrorMessage(new Error("std err"))).toBe("std err");
  });

  it("returns string value as-is", () => {
    expect(toErrorMessage("plain string")).toBe("plain string");
  });

  it("returns fallback for unknown types", () => {
    expect(toErrorMessage(42)).toBe("Unknown error");
    expect(toErrorMessage(null)).toBe("Unknown error");
    expect(toErrorMessage(undefined)).toBe("Unknown error");
  });
});
