import { useId } from "react";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}

export function Toggle({ label, checked, onChange, id }: ToggleProps) {
  const generatedId = useId();
  const toggleId = id ?? generatedId;
  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={toggleId}
        className="text-sm text-neutral-700 dark:text-neutral-300"
      >
        {label}
      </label>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          checked ? "bg-accent" : "bg-neutral-300 dark:bg-neutral-600",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
