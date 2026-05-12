import { useTheme } from "@presentation/hooks/useTheme";
import { Button } from "./ui/Button";
import { MoonIcon, SunIcon } from "./ui/Icon";

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const label =
    resolved === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
