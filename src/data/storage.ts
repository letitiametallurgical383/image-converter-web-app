import { StorageError } from "@core/errors";

export interface StorageAdapter<T> {
  read(): T | null;
  write(value: T): void;
  clear(): void;
}

export function createJsonStorage<T>(
  key: string,
  validate: (value: unknown) => T,
): StorageAdapter<T> {
  return {
    read(): T | null {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return validate(JSON.parse(raw));
      } catch (err) {
        console.warn(`[storage] failed to read ${key}`, err);
        return null;
      }
    },
    write(value: T): void {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        throw new StorageError(
          `Unable to persist ${key}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    },
    clear(): void {
      try {
        localStorage.removeItem(key);
      } catch {
        return;
      }
    },
  };
}
