import { Loader2, User } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn("size-5 animate-spin text-muted", className)} aria-label="Carregando" />;

export const PageLoading = () => <div className="grid place-items-center py-24"><Spinner className="size-7" /></div>;

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: string; actions?: React.ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        {back && <Link to={back.to} className="mb-2 inline-block text-xs font-medium text-muted no-underline hover:text-ink">← {back.label}</Link>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="grid size-10 place-items-center rounded-md border border-line bg-surface text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Progress({ value, tone = "success" }: { value: number; tone?: "success" | "brand" | "danger" }) {
  const color = { success: "bg-success", brand: "bg-accent", danger: "bg-danger" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

/** Faixa de indicadores (EvenTum): um único contêiner com divisores. */
export function StatGroup({ children }: { children: React.ReactNode }) {
  return <div className="grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "indigo" | "violet" | "green" | "slate" }) {
  const dot = { indigo: "bg-accent", violet: "bg-pink", green: "bg-mint", slate: "bg-sky" }[tone ?? "indigo"];
  return (
    <div className="p-5">
      <p className="flex items-center gap-2 text-xs font-medium text-muted"><span className={cn("size-2 rounded-full", dot)} aria-hidden />{label}</p>
      <p className="mt-3 truncate font-display text-3xl font-extrabold tracking-[-0.03em]">{value}</p>
    </div>
  );
}

/** Abas com sublinhado (WEF/Focus). */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("relative flex min-h-11 items-center gap-2 px-4 text-sm font-medium whitespace-nowrap transition", value === t.id ? "text-ink" : "text-muted hover:text-ink")}>
          {t.icon}{t.label}
          {t.count !== undefined && t.count > 0 && <span className="rounded-md bg-subtle px-1.5 text-xs">{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-accent" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

/** Avatar padrão: ícone de usuário (lucide) em círculo. */
export function Avatar({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-7", md: "size-9", lg: "size-12" }[size];
  const icon = { sm: "size-3.5", md: "size-[18px]", lg: "size-6" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-brand-soft text-brand", box, className)} aria-hidden>
      <User className={icon} />
    </span>
  );
}
