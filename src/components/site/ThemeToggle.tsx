import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  // Server render and first paint assume "system"; the real preference is read
  // after mount so the markup stays identical on both sides.
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readStoredTheme();
    setPreference(stored);
    setResolved(resolveTheme(stored));
  }, []);

  // Follow the operating system while the visitor has not made a choice.
  useEffect(() => {
    if (preference !== "system" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      applyTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const choose = useCallback((value: string) => {
    const next = value as ThemePreference;
    setPreference(next);
    const nextResolved = resolveTheme(next);
    setResolved(nextResolved);
    applyTheme(nextResolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
  }, []);

  const Icon = resolved === "dark" ? Moon : Sun;
  const current = options.find((option) => option.value === preference)?.label ?? "System";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`min-h-11 min-w-11 rounded-xl ${className ?? ""}`}
          aria-label={`Colour theme: ${current}. Change theme`}
        >
          <Icon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Colour theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={choose}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="gap-2">
              <option.icon className="size-4" aria-hidden="true" />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
