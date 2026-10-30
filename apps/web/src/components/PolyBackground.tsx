import { cn } from "@/lib/utils";

/** Fundo geométrico em degradê (linhas violeta/menta), no espírito dos eventos de tecnologia. */
export function PolyBackground({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute inset-0 size-full opacity-75", className)} viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-hidden fill="none">
      <defs>
        <linearGradient id="pg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34e0a1" stopOpacity="0.38" /><stop offset="1" stopColor="#34e0a1" stopOpacity="0" /></linearGradient>
        <linearGradient id="pg2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8b6cf7" stopOpacity="0.5" /><stop offset="1" stopColor="#6c84f5" stopOpacity="0" /></linearGradient>
        <linearGradient id="pg3" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#6c84f5" stopOpacity="0.35" /><stop offset="1" stopColor="#8b6cf7" stopOpacity="0" /></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0" r="0.8"><stop offset="0" stopColor="#8b6cf7" stopOpacity="0.35" /><stop offset="1" stopColor="#8b6cf7" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="1200" height="700" fill="url(#glow)" />
      <polygon points="0,0 380,0 140,330" fill="url(#pg1)" />
      <polygon points="1200,0 760,0 980,380" fill="url(#pg2)" />
      <polygon points="1200,700 700,700 1000,300" fill="url(#pg3)" />
      <g stroke="#34e0a1" strokeOpacity="0.35" strokeWidth="1.2">
        <path d="M0 0 L140 330 L380 0" /><path d="M140 330 L0 520" /><path d="M140 330 L420 560" />
      </g>
      <g stroke="#8b6cf7" strokeOpacity="0.45" strokeWidth="1.2">
        <path d="M1200 0 L980 380 L760 0" /><path d="M980 380 L1200 460" /><path d="M980 380 L820 700" /><path d="M1000 300 L700 700" /><path d="M1000 300 L1200 700" />
      </g>
    </svg>
  );
}
