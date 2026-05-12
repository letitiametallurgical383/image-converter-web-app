import { usePWA } from "@presentation/hooks/usePWA";
import { Button } from "./ui/Button";
import { CloseIcon, RefreshIcon, WifiOffIcon } from "./ui/Icon";

export function PWAStatus() {
  const { isOffline, needRefresh, updateServiceWorker, closeUpdatePrompt } =
    usePWA();

  return (
    <>
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-neutral-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm dark:bg-neutral-100/90 dark:text-neutral-900"
        >
          <WifiOffIcon width={14} height={14} />
          Offline mode
        </div>
      )}

      {needRefresh && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-lg dark:border-border-dark dark:bg-surface-dark-subtle"
        >
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Update available
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => updateServiceWorker()}>
              <RefreshIcon width={14} height={14} />
              Reload
            </Button>
            <Button variant="ghost" size="sm" onClick={closeUpdatePrompt}>
              <CloseIcon width={14} height={14} />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
