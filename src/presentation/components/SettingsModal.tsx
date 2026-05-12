import { MAX_CONCURRENCY, MIN_CONCURRENCY } from "@core/constants";
import type { ConverterSettings } from "@core/types";
import { clamp } from "@domain/validation";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { Toggle } from "./ui/Toggle";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ConverterSettings;
  onChange: (next: Partial<ConverterSettings>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onChange,
}: SettingsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="App Settings">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Configure advanced options for batch processing. These settings apply
          globally to all conversions.
        </p>

        <div className="flex flex-col gap-5">
          <Input
            label={`Concurrency Limit (${MIN_CONCURRENCY}–${MAX_CONCURRENCY})`}
            type="number"
            min={MIN_CONCURRENCY}
            max={MAX_CONCURRENCY}
            step={1}
            value={settings.concurrency}
            onChange={(e) =>
              onChange({
                concurrency: clamp(
                  Math.round(Number(e.target.value) || MIN_CONCURRENCY),
                  MIN_CONCURRENCY,
                  MAX_CONCURRENCY,
                ),
              })
            }
          />
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Higher concurrency uses more CPU and memory but finishes faster.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Toggle
            label="Keep metadata (EXIF/IPTC/XMP/ICC)"
            checked={settings.keepMetadata}
            onChange={(next) => onChange({ keepMetadata: next })}
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-[52px]">
            Preserve original image metadata only when you need it.
            EXIF/IPTC/XMP data can include GPS location, camera identifiers,
            dates, author names, and editing history. Metadata preservation is
            available for JPG, PNG, and WebP output only; it is not supported
            for AVIF.
          </p>
        </div>
      </div>
    </Modal>
  );
}
