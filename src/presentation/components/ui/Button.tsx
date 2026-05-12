import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:bg-neutral-400 dark:disabled:bg-neutral-700",
  secondary:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:text-neutral-300 dark:hover:bg-neutral-800",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", leading, className, children, ...rest },
    ref,
  ) {
    const classes = [
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-60",
      VARIANT_CLASSES[variant],
      SIZE_CLASSES[size],
      className ?? "",
    ].join(" ");
    return (
      <button ref={ref} className={classes} {...rest}>
        {leading}
        {children}
      </button>
    );
  },
);
