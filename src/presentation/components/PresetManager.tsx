import { toErrorMessage } from "@core/errors";
import type { Preset } from "@core/types";
import { useRef, useState } from "react";
import { Button } from "./ui/Button";
import { TrashIcon } from "./ui/Icon";
import { Input } from "./ui/Input";

export interface PresetManagerProps {
  presets: Preset[];
  onSave: (name: string) => void;
  onApply: (id: string) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  isEmbedded?: boolean;
}

export function PresetManager({
  presets,
  onSave,
  onApply,
  onRemove,
  onExport,
  onImport,
  isEmbedded = false,
}: PresetManagerProps) {
  const [name, setName] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
  };

  const handleImportClick = () => inputRef.current?.click();

  const handleImportChange = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      await onImport(file);
    } catch (err) {
      setImportError(toErrorMessage(err));
    }
  };

  return (
    <div
      className={
        isEmbedded
          ? "flex flex-col gap-5"
          : "flex flex-col gap-5 rounded-3xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl transition-all dark:border-white/10 dark:bg-surface-dark-subtle/70"
      }
    >
      <header
        className={
          isEmbedded
            ? "flex items-center justify-end gap-1 pb-2 border-b border-border/50 dark:border-border-dark/50"
            : "flex items-center justify-between pb-2 border-b border-border/50 dark:border-border-dark/50"
        }
      >
        {!isEmbedded && (
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Presets
          </h2>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs px-2 h-7 rounded-md font-medium text-neutral-600 dark:text-neutral-300"
            onClick={handleImportClick}
          >
            Import
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs px-2 h-7 rounded-md font-medium text-neutral-600 dark:text-neutral-300"
            onClick={onExport}
            disabled={presets.length === 0}
          >
            Export
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json"
            aria-label="Import presets from JSON file"
            className="hidden"
            onChange={async (e) => {
              await handleImportChange(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {importError && (
        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {importError}
        </div>
      )}

      {presets.length === 0 ? (
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border/60 bg-white/40 p-4 text-center text-xs text-neutral-500 dark:border-border-dark/60 dark:bg-black/20 dark:text-neutral-400">
          No presets saved yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
          {presets.map((preset) => (
            <li
              key={preset.id}
              className="group flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-white/60 px-3 py-2 text-sm transition-colors hover:border-accent/30 hover:bg-accent/5 dark:border-white/5 dark:bg-black/20 dark:hover:border-accent/30 dark:hover:bg-accent/10"
            >
              <span className="truncate text-neutral-800 dark:text-neutral-200 font-medium text-xs">
                {preset.name}
              </span>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-[10px] px-2.5 rounded-lg"
                  onClick={() => onApply(preset.id)}
                >
                  Apply
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => onRemove(preset.id)}
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-3 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Input
              label="Preset name"
              placeholder="Enter preset name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            className="sm:w-auto w-full shadow-sm"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
