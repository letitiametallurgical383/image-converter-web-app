import { FORMAT_LABEL, SUPPORTED_OUTPUT_FORMATS } from "@core/constants";
import type { ConverterSettings, OutputFormat } from "@core/types";
import { usesQuality } from "@domain/formats";
import { clamp } from "@domain/validation";
import { type ChangeEvent, useCallback } from "react";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Slider } from "./ui/Slider";
import { Toggle } from "./ui/Toggle";

export interface ControlsPanelProps {
  settings: ConverterSettings;
  onChange: (next: Partial<ConverterSettings>) => void;
  onChangeCrop: (next: Partial<ConverterSettings["crop"]>) => void;
  onReset: () => void;
  isEmbedded?: boolean;
}

export function ControlsPanel({
  settings,
  onChange,
  onChangeCrop,
  onReset,
  isEmbedded = false,
}: ControlsPanelProps) {
  const formatOptions = SUPPORTED_OUTPUT_FORMATS.map((f) => ({
    value: f,
    label: FORMAT_LABEL[f],
  }));

  const handleCrop = useCallback(
    (key: keyof ConverterSettings["crop"]) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const raw = Number(event.target.value);
        if (!Number.isFinite(raw)) return;
        onChangeCrop({ [key]: clamp(raw, 0, 99) });
      },
    [onChangeCrop],
  );

  return (
    <div
      className={
        isEmbedded
          ? "flex flex-col gap-6"
          : "flex flex-col gap-6 rounded-3xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl transition-all dark:border-white/10 dark:bg-surface-dark-subtle/70"
      }
    >
      {!isEmbedded && (
        <header className="flex items-center justify-between pb-2 border-b border-border/50 dark:border-border-dark/50">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50 tracking-tight">
            Conversion Settings
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-accent hover:text-accent-hover dark:text-accent dark:hover:text-blue-400 transition-colors"
          >
            Reset to default
          </button>
        </header>
      )}

      {isEmbedded && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium text-accent hover:text-accent-hover dark:text-accent dark:hover:text-blue-400 transition-colors"
          >
            Reset to default
          </button>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Format & Quality
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select<OutputFormat>
            label="Output format"
            value={settings.format}
            onChange={(next) => onChange({ format: next })}
            options={formatOptions}
          />
          {(settings.format === "avif" || settings.format === "webp") && (
            <Select<"lossy" | "lossless">
              label="Compression mode"
              value={settings.compressionMode}
              onChange={(next) => onChange({ compressionMode: next })}
              options={[
                { value: "lossy", label: "Lossy (Smaller file size)" },
                { value: "lossless", label: "Lossless (Perfect quality)" },
              ]}
            />
          )}
        </div>

        {usesQuality(settings.format) &&
          settings.compressionMode !== "lossless" && (
            <div className="pt-2">
              <Slider
                label="Quality"
                value={Math.round(settings.quality * 100)}
                min={1}
                max={100}
                step={1}
                onChange={(next) => onChange({ quality: next / 100 })}
                valueLabel={`${Math.round(settings.quality * 100)}%`}
              />
            </div>
          )}

        {settings.format === "avif" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Metadata preservation is not available for AVIF output. It remains
            available for JPG, PNG, and WebP.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Crop Dimensions
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Input
            label="Top %"
            type="number"
            min={0}
            max={99}
            step={0.1}
            value={settings.crop.top}
            onChange={handleCrop("top")}
          />
          <Input
            label="Right %"
            type="number"
            min={0}
            max={99}
            step={0.1}
            value={settings.crop.right}
            onChange={handleCrop("right")}
          />
          <Input
            label="Bottom %"
            type="number"
            min={0}
            max={99}
            step={0.1}
            value={settings.crop.bottom}
            onChange={handleCrop("bottom")}
          />
          <Input
            label="Left %"
            type="number"
            min={0}
            max={99}
            step={0.1}
            value={settings.crop.left}
            onChange={handleCrop("left")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          File Naming
        </h3>
        <Input
          label="Prefix"
          placeholder="e.g. web-"
          value={settings.prefix}
          onChange={(e) => onChange({ prefix: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Find Text"
            placeholder="Text to find"
            value={settings.findText}
            onChange={(e) => onChange({ findText: e.target.value })}
          />
          <Input
            label="Replace With"
            placeholder="Replacement"
            value={settings.replaceText}
            onChange={(e) => onChange({ replaceText: e.target.value })}
          />
        </div>
        <div className="pt-1">
          <Toggle
            label="Case-sensitive find & replace"
            checked={settings.findReplaceCaseSensitive}
            onChange={(next) => onChange({ findReplaceCaseSensitive: next })}
          />
        </div>
      </section>
    </div>
  );
}
