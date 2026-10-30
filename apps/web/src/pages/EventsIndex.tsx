import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { PolyBackground } from "@/components/PolyBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, PageLoading } from "@/components/ui/misc";
import { get } from "@/lib/api";
import { homeFor, useMe } from "@/lib/auth";
import { fmtRange } from "@/lib/utils";

interface Item { id: string; slug: string; name: string; description: string; location: string; startsAt: string | null; endsAt: string | null; registrationOpen: boolean }

export default function EventsIndex() {
  const { me } = useMe();
  const q = useQuery({ queryKey: ["pub-events"], queryFn: () => get<{ events: Item[] }>("/events") });
  return (
    <div className="dark min-h-dvh overflow-x-clip bg-canvas text-ink">
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="no-underline" aria-label="Início"><Logo /></Link>
        {me ? <Button asChild variant="outline" size="sm"><Link to={homeFor(me.role)}>Minha área</Link></Button>
          : <div className="flex gap-2"><Button asChild variant="ghost" size="sm"><Link to="/entrar">Entrar</Link></Button><Button asChild variant="outline" size="sm"><Link to="/cadastro">Criar conta</Link></Button></div>}
      </header>
      <section className="relative">
        <PolyBackground />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6">
          <p className="eyebrow">venn · plataforma de hackathons</p>
          <h1 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Hackathons para <span className="gradient-text">criar junto.</span></h1>
          <p className="mt-4 max-w-xl text-muted">Escolha um evento, faça sua inscrição e acompanhe tudo pela plataforma: equipe, desafio, prazos e entregas.</p>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <h2 className="mb-5 text-xl">Eventos</h2>
        {q.isLoading ? <PageLoading /> : (q.data?.events.length ?? 0) === 0 ? <Empty title="Nenhum evento publicado ainda" /> : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {q.data!.events.map((e) => (
              <Link key={e.id} to={`/e/${e.slug}`} className="group rounded-xl border border-line bg-surface p-5 no-underline transition hover:border-accent/60 hover:glow">
                <div className="flex items-start justify-between gap-3"><h3 className="text-lg">{e.name}</h3><ArrowUpRight className="size-5 shrink-0 text-muted transition group-hover:text-accent" aria-hidden /></div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{e.description || "Sem descrição."}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden />{fmtRange(e.startsAt, e.endsAt)}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />{e.location || "A definir"}</span>
                </div>
                <div className="mt-4">{e.registrationOpen ? <Badge tone="success">Inscrições abertas</Badge> : <Badge>Inscrições encerradas</Badge>}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
