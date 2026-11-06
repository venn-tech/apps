import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronDown, ChevronsDown, Clock, CloudUpload, Lightbulb, MapPin, ShieldCheck, Users, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { PolyBackground } from "@/components/PolyBackground";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/misc";
import { get } from "@/lib/api";
import { homeFor, useMe } from "@/lib/auth";
import { cn, fmtHours, fmtRange } from "@/lib/utils";

interface PublicEvent {
  slug: string; name: string; description: string; location: string; startsAt: string | null; endsAt: string | null; registrationOpen: boolean;
  minTeamSize: number; maxTeamSize: number; allowMixedClasses: boolean; problemsPublishedAt: string | null;
  schedule: { day: string; time: string; title: string; description?: string }[]; faq: { q: string; a: string }[]; rulesUrl: string | null; maxFileMb: number;
}

const steps = [
  { icon: Users, title: "Monte sua equipe", text: "Crie sua conta e forme um grupo por código de convite ou por e-mail." },
  { icon: Lightbulb, title: "Conheça o desafio", text: "Os problemas são apresentados na abertura do evento, sem spoilers antes." },
  { icon: Wrench, title: "Investigue e prototipe", text: "Mentores passam de mesa em mesa para apoiar o desenvolvimento da ideia." },
  { icon: CloudUpload, title: "Entregue e apresente", text: "Envie arquivos e links pela plataforma e faça o pitch para a banca." },
];

function Countdown({ to }: { to: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = to ? Math.max(0, new Date(to).getTime() - now) : 0;
  const parts = [["Dias", Math.floor(diff / 864e5)], ["Horas", Math.floor(diff / 36e5) % 24], ["Min", Math.floor(diff / 6e4) % 60], ["Seg", Math.floor(diff / 1e3) % 60]] as const;
  return (
    <div className="flex gap-3" role="timer" aria-label="Contagem regressiva para o evento">
      {parts.map(([l, v]) => (
        <div key={l} className="min-w-[68px] rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-center backdrop-blur">
          <p className="font-mono text-2xl font-semibold tabular-nums">{to ? String(v).padStart(2, "0") : "--"}</p>
          <p className="eyebrow mt-0.5 !text-[10px]">{l}</p>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const { me } = useMe();
  const { slug = "" } = useParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ["pub-event", slug], queryFn: () => get<{ event: PublicEvent }>(`/events/${slug}`), retry: false });
  const [day, setDay] = useState<string | null>(null);
  const days = useMemo(() => [...new Set((data?.event.schedule ?? []).map((s) => s.day))], [data]);
  if (isLoading) return <PageLoading />;
  if (isError || !data) return <div className="dark grid min-h-dvh place-items-center bg-canvas p-6 text-center text-ink"><div><p className="font-display text-3xl font-extrabold">Evento não encontrado</p><p className="mt-2 text-sm text-muted">Confira o endereço ou veja os eventos disponíveis.</p><Button asChild variant="brand" className="mt-5"><Link to="/">Ver eventos</Link></Button></div></div>;
  const e = data.event;
  const join = `/e/${e.slug}/inscrever`;
  const activeDay = day ?? days[0];
  const dates = fmtRange(e.startsAt, e.endsAt);
  const hours = fmtHours(e.startsAt, e.endsAt);
  const marquee = [`${dates}`, "evento presencial", "participe em equipe", "mentoria de mesa em mesa"];

  return (
    <div className="dark min-h-dvh overflow-x-clip bg-canvas text-ink">
      {/* topo */}
      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="no-underline" aria-label="Início"><Logo /></Link>
        <nav aria-label="Seções" className="hidden gap-7 text-sm text-muted md:flex">
          {[["#sobre", "Sobre"], ["#como-funciona", "Como funciona"], ["#cronograma", "Cronograma"], ["#duvidas", "Dúvidas"]].map(([h, l]) => <a key={h} href={h} className="!text-muted no-underline hover:!text-ink">{l}</a>)}
        </nav>
        {me ? <Button asChild variant="outline" size="sm"><Link to={homeFor(me.role)}>Plataforma</Link></Button>
          : <div className="flex gap-2"><Button asChild variant="ghost" size="sm"><Link to="/entrar">Entrar</Link></Button>{e.registrationOpen && <Button asChild variant="outline" size="sm" className="border-mint/60 text-mint hover:bg-mint/10"><Link to={join}>INSCREVA-SE AGORA</Link></Button>}</div>}
      </header>

      {/* hero */}
      <section className="relative">
        <PolyBackground />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-24 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-center lg:pt-16">
          <div>
            <p className="eyebrow">Hackathon</p>
            <p className="mt-3 font-display text-[40px] leading-[1] font-extrabold tracking-[-0.045em] sm:text-[56px]"><span className="gradient-text">{e.name}</span></p>
            <div className="mt-8"><Countdown to={e.startsAt} /></div>
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl">Transforme um problema real em <span className="gradient-text">solução de verdade.</span></h1>
            <div className="mt-8 grid gap-6 sm:grid-cols-[auto_1fr]">
              <ul className="space-y-4 font-mono text-[13px] tracking-[0.06em] uppercase">
                <li className="flex items-center gap-3"><CalendarCheck className="size-6 text-accent" aria-hidden />{dates}</li>
                <li className="flex items-center gap-3"><Clock className="size-6 text-accent" aria-hidden />{hours}</li>
                <li className="flex items-center gap-3"><MapPin className="size-6 text-accent" aria-hidden />{e.location || "Local a definir"}</li>
              </ul>
              <div>
                <p className="text-[15px] text-muted">{e.description}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {me ? <Button asChild variant="mint" size="lg"><Link to={homeFor(me.role)}>IR PARA A PLATAFORMA</Link></Button>
                    : e.registrationOpen ? <Button asChild variant="mint" size="lg"><Link to={join}>GARANTIR MINHA VAGA</Link></Button>
                    : <span className="inline-flex min-h-11 items-center rounded-md border border-line px-5 font-mono text-xs tracking-wider uppercase">Inscrições encerradas</span>}
                  <Button asChild variant="outline" size="lg"><a href="#cronograma">VER CRONOGRAMA</a></Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="relative mx-auto flex max-w-6xl items-center gap-4 px-4 sm:px-6" aria-hidden><span className="h-px flex-1 bg-line" /><ChevronsDown className="size-5 text-muted" /><span className="h-px flex-1 bg-line" /></div>
      </section>

      {/* faixa em movimento */}
      <div className="mt-16 overflow-hidden bg-[#3a3da8] py-4 text-white" aria-hidden>
        <div className="animate-marquee flex w-max whitespace-nowrap text-lg font-bold">
          {Array.from({ length: 2 }).map((_, k) => (<div key={k} className="flex">{marquee.map((m) => <span key={m} className="flex items-center">{m}<span className="mx-8 font-mono text-2xl text-mint">&lt;/&gt;</span></span>)}</div>))}
        </div>
      </div>

      {/* sobre / como funciona */}
      <section id="sobre" className="scroll-mt-4">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Sobre</p>
          <h2 className="display mt-3 max-w-2xl text-3xl sm:text-4xl">Um evento para criar <span className="gradient-text">junto</span>, com o que você aprendeu na formação.</h2>
          <p className="mt-4 max-w-2xl text-muted">{e.problemsPublishedAt ? `Os problemas serão divulgados em ${new Date(e.problemsPublishedAt).toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}, na abertura do evento.` : "Os problemas serão apresentados na abertura do evento."}</p>
          <div id="como-funciona" className="mt-12 grid scroll-mt-20 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="group rounded-xl border border-line bg-surface p-5 transition hover:border-accent/60 hover:glow">
                <div className="flex items-center justify-between"><span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand"><s.icon className="size-5" aria-hidden /></span><span className="font-mono text-xs text-muted">0{i + 1}</span></div>
                <h3 className="mt-5 text-lg">{s.title}</h3><p className="mt-1.5 text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cronograma */}
      <section id="cronograma" className="scroll-mt-4 border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Cronograma</p>
          <h2 className="display mt-3 text-3xl sm:text-4xl">Programação</h2>
          <div role="tablist" className="mt-6 inline-flex rounded-lg border border-line bg-surface p-1">
            {days.map((d) => (
              <button key={d} role="tab" aria-selected={d === activeDay} onClick={() => setDay(d)} className={cn("rounded-md px-5 py-2 text-sm font-semibold transition", d === activeDay ? "bg-accent text-accent-fg" : "text-muted hover:text-ink")}>{d}</button>
            ))}
          </div>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {e.schedule.filter((s) => s.day === activeDay).map((s, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-5"><span className="font-mono text-xs font-semibold tracking-wider text-mint uppercase">{s.time}</span>
                <h3 className="mt-2 text-lg">{s.title}</h3>{s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Horários exatos serão confirmados pela organização.</p>
        </div>
      </section>

      {/* regras + faq */}
      <section id="duvidas" className="scroll-mt-4">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Equipes e regras</p>
            <h2 className="display mt-3 text-3xl">Antes de começar</h2>
            <ul className="mt-6 space-y-3 text-sm">
              {[`Equipes de ${e.minTeamSize} a ${e.maxTeamSize} pessoas.`, "Cada estudante integra somente uma equipe.", e.allowMixedClasses ? "Equipes podem misturar turmas." : "Equipes são formadas dentro da mesma turma.", `Arquivos: PDF, DOCX, PPTX, JPG, PNG, MP4, ZIP (até ${e.maxFileMb} MB) ou links.`, "Leve notebook ou celular e o que você usa para prototipar."].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-mint text-[11px] font-bold text-[#052e1f]">✓</span>{t}</li>
              ))}
            </ul>
            <p className="mt-6 flex gap-2 text-sm text-muted"><ShieldCheck className="size-5 shrink-0 text-success" aria-hidden />Seus materiais ficam privados e o uso de imagem é autorizado à parte.</p>
            {e.rulesUrl && <a className="link mt-4 inline-block text-sm" href={e.rulesUrl} target="_blank" rel="noreferrer">Ler o regulamento ↗</a>}
          </div>
          <div>
            <h2 className="text-2xl">Dúvidas frequentes</h2>
            <div className="mt-5 space-y-3">
              {e.faq.map((f) => (
                <details key={f.q} className="group rounded-lg border border-line bg-surface"><summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold marker:hidden">{f.q}<ChevronDown className="size-4 text-muted transition group-open:rotate-180" aria-hidden /></summary><p className="px-5 pb-4 text-sm text-muted">{f.a}</p></details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* chamada final */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-[#2a2170] via-[#1d1a4f] to-[#0f2a2b] p-8 sm:p-12">
          <PolyBackground className="opacity-60" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <h2 className="display max-w-lg text-3xl sm:text-4xl">Vai topar o <span className="gradient-text">desafio?</span></h2>
            {me ? <Button asChild variant="mint" size="lg"><Link to={homeFor(me.role)}>IR PARA A PLATAFORMA</Link></Button>
              : e.registrationOpen ? <Button asChild variant="mint" size="lg"><Link to={join}>GARANTIR MINHA VAGA</Link></Button> : null}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6"><Logo /><p>Evento organizado na plataforma venn.</p></div>
        <div className="h-1 bg-gradient-to-r from-mint via-accent to-pink" aria-hidden />
      </footer>
    </div>
  );
}
