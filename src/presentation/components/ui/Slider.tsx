import { type ChangeEvent, useId } from "react";

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  valueLabel?: string;
  id?: string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  id,
}: SliderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };
  const generatedId = useId();
  const sliderId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label
          htmlFor={sliderId}
          className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
        <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
          {valueLabel ?? value}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="h-2 w-full appearance-none rounded-full bg-neutral-200 accent-accent dark:bg-neutral-700"
      />
    </div>
  );
}
