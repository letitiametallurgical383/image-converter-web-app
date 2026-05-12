export class AppError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class InvalidFileError extends AppError {
  constructor(message: string) {
    super("E_INVALID_FILE", message);
    this.name = "InvalidFileError";
    Object.setPrototypeOf(this, InvalidFileError.prototype);
  }
}

export class UnsupportedFormatError extends AppError {
  constructor(message: string) {
    super("E_UNSUPPORTED_FORMAT", message);
    this.name = "UnsupportedFormatError";
    Object.setPrototypeOf(this, UnsupportedFormatError.prototype);
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super("E_STORAGE", message);
    this.name = "StorageError";
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("E_VALIDATION", message);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConversionError extends AppError {
  constructor(message: string) {
    super("E_CONVERSION", message);
    this.name = "ConversionError";
    Object.setPrototypeOf(this, ConversionError.prototype);
  }
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}
