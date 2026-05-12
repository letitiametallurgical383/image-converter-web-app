import type { BatchItem, ConverterSettings, OutputFormat } from "@core/types";
import { useBatchDownload } from "@presentation/hooks/useBatchDownload";
import { useCallback, useEffect, useMemo } from "react";
import { ImageQueue } from "./ImageQueue";
import { Button } from "./ui/Button";
import { DownloadIcon, PackageIcon } from "./ui/Icon";
import { Select } from "./ui/Select";

interface SimpleModeProps {
  settings: ConverterSettings;
  items: BatchItem[];
  isRunning: boolean;
  onSettingsChange: (next: Partial<ConverterSettings>) => void;
  onConvert: () => void;
  onCancel: () => void;
  onRemoveItem: (id: string) => void;
  onAddItems: (sources: import("@core/types").SourceFile[]) => void;
}

type QualityLevel = "low" | "medium" | "high" | "ultra";

const QUALITY_PRESETS: Record<OutputFormat, Record<QualityLevel, number>> = {
  jpeg: {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    ultra: 1.0,
  },
  webp: {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    ultra: 1.0,
  },
  avif: {
    low: 0.25,
    medium: 0.5,
    high: 0.75,
    ultra: 1.0,
  },
  png: {
    low: 1.0,
    medium: 1.0,
    high: 1.0,
    ultra: 1.0,
  },
};

export function SimpleMode({
  settings,
  items,
  isRunning,
  onSettingsChange,
  onConvert,
  onCancel,
  onRemoveItem,
  onAddItems,
}: SimpleModeProps) {
  const { downloadAll, downloadZip, isZipping, zipProgress } =
    useBatchDownload();

  useEffect(() => {
    if (
      (settings.format === "avif" || settings.format === "webp") &&
      settings.compressionMode !== "lossy"
    ) {
      onSettingsChange({ compressionMode: "lossy" });
      return;
    }
    if (settings.format === "png" && settings.compressionMode !== "lossless") {
      onSettingsChange({ compressionMode: "lossless" });
    }
  }, [settings.format, settings.compressionMode, onSettingsChange]);

  const currentQualityLevel = useMemo((): QualityLevel => {
    const quality = settings.quality;
    const presets = QUALITY_PRESETS[settings.format];

    if (quality <= presets.low) return "low";
    if (quality <= presets.medium) return "medium";
    if (quality <= presets.high) return "high";
    return "ultra";
  }, [settings.quality, settings.format]);

  const handleFormatChange = (format: OutputFormat) => {
    const defaultQuality = QUALITY_PRESETS[format].medium;
    onSettingsChange({
      format,
      quality: defaultQuality,
      compressionMode: format === "png" ? "lossless" : "lossy",
    });
  };

  const handleQualityChange = (level: QualityLevel) => {
    const quality = QUALITY_PRESETS[settings.format][level];
    onSettingsChange({
      quality,
      compressionMode:
        settings.format === "avif" || settings.format === "webp"
          ? "lossy"
          : settings.format === "png"
            ? "lossless"
            : settings.compressionMode,
    });
  };

  const hasItems = items.length > 0;
  const canConvert = hasItems && !isRunning;
  const allDone = hasItems && items.every((item) => item.status === "done");
  const hasAnyDone = items.some((item) => item.status === "done");

  const doneItems = useMemo(
    () => items.filter((item) => item.status === "done" && item.artifact),
    [items],
  );

  const handleClearAll = useCallback(() => {
    items.forEach((item) => onRemoveItem(item.source.id));
  }, [items, onRemoveItem]);

  const handleDownloadAll = useCallback(() => {
    downloadAll(doneItems);
  }, [doneItems, downloadAll]);

  const handleZipDownload = useCallback(async () => {
    await downloadZip(doneItems);
  }, [doneItems, downloadZip]);

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:gap-8">
      <div className="flex flex-col gap-6 order-2 md:order-1">
        <div className="md:hidden">
          <ImageQueue
            items={items}
            onRemoveItem={onRemoveItem}
            onAddItems={onAddItems}
            onClear={handleClearAll}
          />
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70">
          <Select
            label="Convert to"
            value={settings.format}
            onChange={handleFormatChange}
            options={[
              { value: "jpeg", label: "JPG" },
              { value: "webp", label: "WebP" },
              { value: "avif", label: "AVIF" },
              { value: "png", label: "PNG" },
            ]}
          />
          {settings.format === "avif" && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              Metadata preservation is not available for AVIF output. It remains
              available for JPG, PNG, and WebP.
            </p>
          )}
        </div>

        {settings.format !== "png" && (
          <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70">
            <h3 className="mb-3 block text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Quality
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleQualityChange("low")}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  currentQualityLevel === "low"
                    ? "bg-accent text-white shadow-md"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                Low
                <div className="mt-1 text-xs opacity-70">Smaller file</div>
              </button>
              <button
                type="button"
                onClick={() => handleQualityChange("medium")}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  currentQualityLevel === "medium"
                    ? "bg-accent text-white shadow-md"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                Medium
                <div className="mt-1 text-xs opacity-70">Balanced</div>
              </button>
              <button
                type="button"
                onClick={() => handleQualityChange("high")}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  currentQualityLevel === "high"
                    ? "bg-accent text-white shadow-md"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                High
                <div className="mt-1 text-xs opacity-70">Good quality</div>
              </button>
              <button
                type="button"
                onClick={() => handleQualityChange("ultra")}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  currentQualityLevel === "ultra"
                    ? "bg-accent text-white shadow-md"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                Ultra
                <div className="mt-1 text-xs opacity-70">Best quality</div>
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/20 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70">
          <div className="flex flex-col gap-3">
            {isRunning ? (
              <Button onClick={onCancel} variant="secondary" className="w-full">
                Cancel
              </Button>
            ) : allDone ? (
              <>
                {doneItems.length > 1 ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownloadAll}
                      variant="secondary"
                      className="flex-1"
                      leading={<DownloadIcon />}
                    >
                      Download All
                    </Button>
                    <Button
                      onClick={handleZipDownload}
                      variant="primary"
                      className="flex-1"
                      disabled={isZipping}
                      leading={<PackageIcon />}
                    >
                      {isZipping
                        ? `Zipping… ${Math.round(zipProgress * 100)}%`
                        : "Download ZIP"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleDownloadAll}
                    variant="primary"
                    className="w-full"
                    leading={<DownloadIcon />}
                  >
                    Download
                  </Button>
                )}
                <Button
                  onClick={handleClearAll}
                  variant="ghost"
                  className="w-full"
                >
                  Clear All
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onConvert}
                  variant="primary"
                  className="w-full"
                  disabled={!canConvert}
                >
                  Convert{" "}
                  {hasItems
                    ? `${items.length} ${items.length === 1 ? "Image" : "Images"}`
                    : "Images"}
                </Button>
                {hasAnyDone && (
                  <>
                    {doneItems.length > 1 ? (
                      <div className="flex gap-3">
                        <Button
                          onClick={handleDownloadAll}
                          variant="secondary"
                          className="flex-1"
                          leading={<DownloadIcon />}
                        >
                          Download All
                        </Button>
                        <Button
                          onClick={handleZipDownload}
                          variant="secondary"
                          className="flex-1"
                          disabled={isZipping}
                          leading={<PackageIcon />}
                        >
                          {isZipping
                            ? `Zipping… ${Math.round(zipProgress * 100)}%`
                            : "Download ZIP"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={handleDownloadAll}
                        variant="secondary"
                        className="w-full"
                        leading={<DownloadIcon />}
                      >
                        Download Completed
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:block md:order-2">
        <ImageQueue
          items={items}
          onRemoveItem={onRemoveItem}
          onAddItems={onAddItems}
          onClear={handleClearAll}
        />
      </div>
    </div>
  );
}
