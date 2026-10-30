import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { get } from "@/lib/api";
import type { Activity } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

export default function Activities() {
  const q = useQuery({ queryKey: ["activities"], queryFn: () => get<{ activities: Activity[] }>("/activities") });
  if (q.isLoading) return <PageLoading />;
  const list = q.data?.activities ?? [];
  return (
    <>
      <PageHeader title="Atividades e entregas" subtitle="Cada atividade mostra o prazo, o que é obrigatório e a situação do envio da sua equipe." />
      {list.length === 0 ? <Empty title="Nenhuma atividade publicada" /> : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id}>
              <Link to={`/app/atividades/${a.id}`} className="card flex flex-wrap items-center gap-4 text-ink no-underline transition hover:ring-2 hover:ring-brand/20">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">{a.kind === "final" ? <Flag className="size-5" aria-hidden /> : <CalendarClock className="size-5" aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">{a.title}{a.kind === "final" && <Badge tone="brand">Entrega final</Badge>}<Badge tone={a.required ? "danger" : "neutral"}>{a.required ? "Obrigatória" : "Opcional"}</Badge></span>
                  <span className="mt-0.5 block text-sm text-muted">{a.objective}</span>
                  <span className="mt-1 block text-xs text-muted">Prazo: {fmtDateTime(a.dueAt)}</span>
                </span>
                <span className="flex items-center gap-2">
                  {a.status && <StatusBadge status={a.status} />}
                  {a.verified && <Badge tone="success">Conferida</Badge>}
                  <ChevronRight className="size-5 text-muted" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
