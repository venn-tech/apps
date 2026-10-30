import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * venn: o quadrado (empreendedorismo) e o círculo (tecnologia) se cruzam.
 * A interseção é o "espaço em comum" onde as ideias viram protótipo, como num diagrama de Venn.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  const g = `${id}-g`;
  const c = `${id}-c`;
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden fill="none">
      <defs>
        <clipPath id={c}><rect x="5" y="9" width="22" height="22" rx="6" /></clipPath>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8b6cf7" /><stop offset="1" stopColor="#34e0a1" /></linearGradient>
      </defs>
      <circle cx="26" cy="20" r="11" fill={`url(#${g})`} />
      <circle cx="26" cy="20" r="11" fill="currentColor" clipPath={`url(#${c})`} />
      <rect x="5" y="9" width="22" height="22" rx="6" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-ink", className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[24px] font-extrabold tracking-[-0.06em]">venn</span>
          <span className="mt-0.5 block whitespace-nowrap font-mono text-[8.5px] font-medium tracking-[0.16em] text-muted uppercase">hackathons</span>
        </span>
      )}
    </span>
  );
}
