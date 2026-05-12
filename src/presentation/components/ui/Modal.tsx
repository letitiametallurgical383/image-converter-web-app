import { type ReactNode, useEffect, useId, useRef } from "react";
import { XIcon } from "./Icon";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const prevActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      prevActiveElement.current = document.activeElement;
      const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTORS);
      const first = focusable?.[0] as HTMLElement | undefined;
      first?.focus();
    } else {
      document.body.style.overflow = "";
      (prevActiveElement.current as HTMLElement | null)?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = modalRef.current?.querySelectorAll(FOCUSABLE_SELECTORS);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className="relative w-full max-w-md scale-100 flex flex-col max-h-[90vh] rounded-3xl border border-white/20 bg-white/95 text-left align-middle shadow-xl backdrop-blur-xl transition-all dark:border-white/10 dark:bg-neutral-900/90"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between p-6 sm:px-8 border-b border-border/50 dark:border-border-dark/50">
          <h3
            id={titleId}
            className="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-50 tracking-tight"
          >
            {title}
          </h3>
          <button
            type="button"
            className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 pt-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
