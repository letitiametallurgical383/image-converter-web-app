import { BatchActions } from "@presentation/components/BatchActions";
import { ControlsPanel } from "@presentation/components/ControlsPanel";
import { ImageQueue } from "@presentation/components/ImageQueue";
import { PresetManager } from "@presentation/components/PresetManager";
import { SettingsModal } from "@presentation/components/SettingsModal";
import { SimpleMode } from "@presentation/components/SimpleMode";
import { ThemeToggle } from "@presentation/components/ThemeToggle";
import {
  BookmarkIcon,
  SettingsIcon,
  SlidersIcon,
} from "@presentation/components/ui/Icon";
import { Modal } from "@presentation/components/ui/Modal";
import { useConverter } from "@presentation/hooks/useConverter";
import { usePresets } from "@presentation/hooks/usePresets";
import { useConverterStore } from "@presentation/store/converterStore";
import { useEffect, useMemo, useState } from "react";
export function HomePage() {
  const settings = useConverterStore((s) => s.settings);
  const simpleItems = useConverterStore((s) => s.simpleItems);
  const advancedItems = useConverterStore((s) => s.advancedItems);
  const isRunning = useConverterStore((s) => s.isRunning);
  const mode = useConverterStore((s) => s.mode);
  const setMode = useConverterStore((s) => s.setMode);
  const setSettings = useConverterStore((s) => s.setSettings);
  const setCrop = useConverterStore((s) => s.setCrop);
  const resetSettings = useConverterStore((s) => s.resetSettings);
  const addItems = useConverterStore((s) => s.addItems);
  const removeItem = useConverterStore((s) => s.removeItem);
  const clearItems = useConverterStore((s) => s.clearItems);

  const items = mode === "simple" ? simpleItems : advancedItems;

  const { runBatch, cancelBatch } = useConverter();
  const { presets, saveCurrent, apply, remove, exportAll, importFrom } =
    usePresets();

  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isControlsModalOpen, setIsControlsModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const completedCount = useMemo(
    () => items.filter((i) => i.status === "done").length,
    [items],
  );

  useEffect(() => {
    if (
      completedCount > 0 &&
      completedCount === items.length &&
      items.length > 0
    ) {
      setStatusMessage(`All ${completedCount} images converted successfully`);
    } else if (completedCount > 0) {
      setStatusMessage(`${completedCount} of ${items.length} images converted`);
    } else {
      setStatusMessage("");
    }
  }, [completedCount, items.length]);

  return (
    <main className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-10 p-4 sm:p-8 lg:p-10 xl:px-16">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded"
      >
        Skip to main content
      </a>

      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-2">
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Image Converter Web App
          </h1>
          <p className="text-xs sm:text-sm mt-0.5 sm:mt-1 text-neutral-500 dark:text-neutral-400">
            Client-side batch conversion. Your files are never uploaded.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-full bg-neutral-200/50 p-0.5 sm:p-1 dark:bg-neutral-800/50">
            <button
              type="button"
              onClick={() => setMode("simple")}
              aria-pressed={mode === "simple"}
              className={`rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                mode === "simple"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setMode("advanced")}
              aria-pressed={mode === "advanced"}
              className={`rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
                mode === "advanced"
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              }`}
            >
              Advanced
            </button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsAppSettingsOpen(true)}
              className="flex items-center justify-center rounded-full p-2 sm:p-2.5 text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent backdrop-blur-md"
              aria-label="App Settings"
              title="App Settings"
            >
              <SettingsIcon />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {mode === "advanced" && (
        <div className="md:hidden flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsControlsModalOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/70 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70"
            >
              <SlidersIcon className="text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Settings
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPresetsModalOpen(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/70 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-surface-dark-subtle/70"
            >
              <BookmarkIcon className="text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Presets
              </span>
            </button>
          </div>
          <ImageQueue
            items={items}
            onRemoveItem={removeItem}
            onAddItems={addItems}
            onClear={clearItems}
          />
          <BatchActions
            items={items}
            isRunning={isRunning}
            onStart={runBatch}
            onCancel={cancelBatch}
          />
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {statusMessage}
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Workspace"
        className={`grid grid-cols-1 gap-8 ${mode === "simple" ? "xl:grid-cols-3" : "hidden md:grid md:grid-cols-2 lg:grid-cols-3"}`}
      >
        {mode === "simple" ? (
          <div className="xl:col-span-3 w-full">
            <SimpleMode
              settings={settings}
              items={items}
              isRunning={isRunning}
              onSettingsChange={setSettings}
              onConvert={runBatch}
              onCancel={cancelBatch}
              onRemoveItem={removeItem}
              onAddItems={addItems}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:order-2 lg:order-1">
              <div className="lg:hidden flex flex-col gap-4">
                <ImageQueue
                  items={items}
                  onRemoveItem={removeItem}
                  onAddItems={addItems}
                  onClear={clearItems}
                />
                <BatchActions
                  items={items}
                  isRunning={isRunning}
                  onStart={runBatch}
                  onCancel={cancelBatch}
                />
              </div>
              <div className="hidden lg:flex flex-col gap-4">
                <ControlsPanel
                  settings={settings}
                  onChange={setSettings}
                  onChangeCrop={setCrop}
                  onReset={resetSettings}
                />
              </div>
            </div>

            <div className="hidden lg:flex flex-col gap-4 order-2">
              <ImageQueue
                items={items}
                onRemoveItem={removeItem}
                onAddItems={addItems}
                onClear={clearItems}
              />
              <BatchActions
                items={items}
                isRunning={isRunning}
                onStart={runBatch}
                onCancel={cancelBatch}
              />
            </div>

            <div className="flex flex-col gap-4 md:order-1 lg:order-3">
              <div className="hidden md:flex lg:hidden flex-col gap-4">
                <ControlsPanel
                  settings={settings}
                  onChange={setSettings}
                  onChangeCrop={setCrop}
                  onReset={resetSettings}
                />
                <PresetManager
                  presets={presets}
                  onSave={saveCurrent}
                  onApply={apply}
                  onRemove={remove}
                  onExport={exportAll}
                  onImport={importFrom}
                />
              </div>
              <div className="hidden lg:flex flex-col gap-4">
                <PresetManager
                  presets={presets}
                  onSave={saveCurrent}
                  onApply={apply}
                  onRemove={remove}
                  onExport={exportAll}
                  onImport={importFrom}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
        All image processing happens locally in your browser. Your files are never uploaded.
      </footer>

      <SettingsModal
        isOpen={isAppSettingsOpen}
        onClose={() => setIsAppSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />

      <Modal
        isOpen={isControlsModalOpen}
        onClose={() => setIsControlsModalOpen(false)}
        title="Conversion Settings"
      >
        <ControlsPanel
          settings={settings}
          onChange={setSettings}
          onChangeCrop={setCrop}
          onReset={resetSettings}
          isEmbedded={true}
        />
      </Modal>

      <Modal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        title="Manage Presets"
      >
        <PresetManager
          presets={presets}
          onSave={saveCurrent}
          onApply={apply}
          onRemove={remove}
          onExport={exportAll}
          onImport={importFrom}
          isEmbedded={true}
        />
      </Modal>
    </main>
  );
}
