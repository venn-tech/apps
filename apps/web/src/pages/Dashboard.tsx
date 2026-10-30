import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, CalendarClock, CheckCircle2, FileText, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, Empty, PageHeader, PageLoading, Stat, StatGroup } from "@/components/ui/misc";
import { get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Activity, Announcement, Team } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

export default function Dashboard() {
  const { me } = useMe();
  const team = useQuery({ queryKey: ["team"], queryFn: () => get<{ team: Team | null }>("/teams/mine") });
  const acts = useQuery({ queryKey: ["activities"], queryFn: () => get<{ activities: Activity[] }>("/activities") });
  const news = useQuery({ queryKey: ["announcements"], queryFn: () => get<{ announcements: Announcement[] }>("/announcements") });
  if (team.isLoading || acts.isLoading) return <PageLoading />;

  const t = team.data?.team ?? null;
  const list = acts.data?.activities ?? [];
  const required = list.filter((a) => a.required);
  const done = required.filter((a) => a.status === "submitted" || a.status === "feedback").length;
  const upcoming = list.filter((a) => a.status !== "submitted" && a.status !== "feedback" && a.status !== "closed").slice(0, 4);
  const current = upcoming[0];

  return (
    <>
      <PageHeader title={`Olá, ${me?.displayName}!`} subtitle="Acompanhe sua equipe, os prazos e as entregas."  />

      <StatGroup>
        <Stat label="Minha equipe" tone="indigo" value={t ? t.name : "Sem equipe"} />
        <Stat label="Integrantes" tone="violet" value={t ? t.members.length : 0} />
        <Stat label="Obrigatórias enviadas" tone="green" value={`${done}/${required.length}`} />
        <Stat label="Próximo prazo" tone="slate" value={current ? fmtDateTime(current.dueAt) : "—"} />
      </StatGroup>

      {!t && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 border border-brand/20 bg-brand-soft/60">
          <div><h2 className="text-lg">Você ainda está sem equipe</h2><p className="text-sm text-muted">Crie uma equipe ou entre em uma com um código de convite.</p></div>
          <Button asChild variant="brand"><Link to="/app/equipe">Formar equipe <ArrowRight /></Link></Button>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card" aria-labelledby="prazos">
          <div className="mb-4 flex items-center justify-between"><h2 id="prazos" className="text-lg">Atividade atual e próximas entregas</h2><Link to="/app/atividades" className="link text-sm">Ver todas</Link></div>
          {upcoming.length === 0 ? <Empty icon={<CheckCircle2 className="size-5" />} title="Tudo em dia">Nenhuma entrega pendente no momento.</Empty> : (
            <ul className="divide-y divide-line">
              {upcoming.map((a, i) => (
                <li key={a.id}>
                  <Link to={`/app/atividades/${a.id}`} className="flex flex-wrap items-center gap-3 py-3.5 text-ink no-underline hover:bg-subtle/60 sm:-mx-3 sm:px-3 sm:rounded-xl">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><FileText className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium">{a.title}{i === 0 && <Badge tone="brand">Atual</Badge>}{!a.required && <Badge>Opcional</Badge>}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="size-3.5" aria-hidden /> Prazo: {fmtDateTime(a.dueAt)}</span>
                    </span>
                    {a.status && <StatusBadge status={a.status} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="card" aria-labelledby="equipe">
            <h2 id="equipe" className="mb-3 flex items-center gap-2 text-lg"><UsersRound className="size-5 text-brand" aria-hidden /> Equipe</h2>
            {t ? (
              <>
                <ul className="space-y-2">{t.members.map((m) => <li key={m.userId} className="flex items-center gap-2.5 text-sm"><Avatar size="sm" />{m.name}{m.userId === t.leaderId && <Badge tone="brand">Líder</Badge>}</li>)}</ul>
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">Problema: <span className="font-medium text-ink">{t.problem?.title ?? "ainda não escolhido"}</span></p>
              </>
            ) : <p className="text-sm text-muted">Sem equipe ainda.</p>}
          </section>

          <section className="card" aria-labelledby="avisos">
            <h2 id="avisos" className="mb-3 flex items-center gap-2 text-lg"><Bell className="size-5 text-brand" aria-hidden /> Avisos recentes</h2>
            {(news.data?.announcements ?? []).slice(0, 3).map((n) => <div key={n.id} className="mb-3 last:mb-0"><p className="text-sm font-semibold">{n.title}</p><p className="text-sm text-muted">{n.body}</p></div>)}
            {(news.data?.announcements.length ?? 0) === 0 && <p className="text-sm text-muted">Nenhum aviso por enquanto.</p>}
          </section>

        </div>
      </div>
    </>
  );
}
