import { forwardRef, type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, description, error, id, className, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? rest.name ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={[
          "h-10 rounded-lg border border-border bg-white px-3 text-sm shadow-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "dark:border-border-dark dark:bg-surface-dark-subtle dark:text-neutral-100",
          "disabled:opacity-60",
          error ? "border-red-500 focus-visible:ring-red-500" : "",
          className ?? "",
        ].join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={description ? `${inputId}-desc` : undefined}
        {...rest}
      />
      {description && (
        <p
          id={`${inputId}-desc`}
          className="text-xs text-neutral-500 dark:text-neutral-400"
        >
          {description}
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
