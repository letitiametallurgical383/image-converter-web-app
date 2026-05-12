import { type ChangeEvent, type ReactNode, useId } from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  id?: string;
  description?: ReactNode;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  id,
  description,
}: SelectProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as T);
  };
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={handleChange}
        className="h-10 rounded-lg border border-border bg-white px-3 text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:border-border-dark dark:bg-surface-dark-subtle dark:text-neutral-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      )}
    </div>
  );
}
