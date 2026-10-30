import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./utils";

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* ignora */ }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

/** Alternador claro/escuro (como no EvenTum). */
export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label="Alternar tema escuro"
      className={cn("relative inline-flex h-9 w-[68px] items-center rounded-full border border-line bg-subtle p-1 transition", className)}
    >
      <span className={cn("grid size-7 place-items-center rounded-full bg-accent text-accent-fg transition-transform", dark && "translate-x-[30px]")}>
        {dark ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      </span>
    </button>
  );
}
