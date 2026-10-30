import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, Bell, BookOpen, CalendarCheck, CalendarDays, Check, ChevronsUpDown, ClipboardList, FileText, GraduationCap, LayoutDashboard, ListChecks,
  LogOut, Menu, PanelLeft, ScrollText, Settings, Users, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { Role } from "@hackaton/shared";
import { get, setActiveEventId, activateEvent } from "@/lib/api";
import { useLogout, useMe } from "@/lib/auth";
import { ThemeToggle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }
interface Group { title: string; items: Item[] }

const nav: Record<Role, Group[]> = {
  student: [
    { title: "Menu principal", items: [
      { to: "/app", label: "Painel", icon: LayoutDashboard, end: true },
      { to: "/app/equipe", label: "Minha equipe", icon: UsersRound },
      { to: "/app/problemas", label: "Problemas", icon: ClipboardList },
      { to: "/app/atividades", label: "Atividades", icon: ListChecks },
    ] },
    { title: "Outros", items: [
      { to: "/app/eventos", label: "Meus eventos", icon: CalendarDays },
      { to: "/app/avisos", label: "Avisos e materiais", icon: Bell },
      { to: "/app/perfil", label: "Meu perfil", icon: Settings },
    ] },
  ],
  mentor: [
    { title: "Mentoria e avaliação", items: [{ to: "/app/equipes", label: "Equipes", icon: UsersRound }] },
    { title: "Outros", items: [{ to: "/app/eventos", label: "Meus eventos", icon: CalendarDays }, { to: "/app/avisos", label: "Avisos e materiais", icon: Bell }] },
  ],
  organizer: [
    { title: "Plataforma", items: [{ to: "/app/admin/eventos", label: "Eventos", icon: CalendarDays }, { to: "/app/admin/pessoas", label: "Pessoas", icon: Users }] },
    { title: "Evento selecionado", items: [
      { to: "/app/admin", label: "Visão geral", icon: LayoutDashboard, end: true },
      { to: "/app/admin/evento", label: "Configurações", icon: CalendarCheck },
      { to: "/app/admin/equipes", label: "Equipes", icon: UsersRound },
      { to: "/app/admin/problemas", label: "Problemas", icon: ClipboardList },
      { to: "/app/admin/atividades", label: "Atividades", icon: ListChecks },
      { to: "/app/admin/entregas", label: "Entregas", icon: FileText },
      { to: "/app/admin/conteudo", label: "Avisos e materiais", icon: BookOpen },
      { to: "/app/admin/avaliacao", label: "Avaliação", icon: GraduationCap },
      { to: "/app/admin/resultados", label: "Resultados", icon: BarChart3 },
      { to: "/app/admin/auditoria", label: "Registro de alterações", icon: ScrollText },
    ] },
  ],
};

const roleLabel: Record<Role, string> = { student: "Estudante", mentor: "Mentor", organizer: "Organizador" };

function SideNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {nav[role].map((g) => (
        <div key={g.title}>
          <p className="eyebrow px-3 pb-2">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted no-underline transition hover:bg-subtle hover:text-ink",
                      isActive && "bg-surface text-ink shadow-xs ring-1 ring-line hover:bg-surface",
                    )
                  }
                >
                  {({ isActive }) => (<>
                    <it.icon className="size-[18px]" aria-hidden />
                    {it.label}
                    {isActive && <span className="absolute top-2.5 right-0 h-5 w-[3px] rounded-l bg-accent" aria-hidden />}
                  </>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const crumbs: Record<string, string> = {
  equipe: "Minha equipe", problemas: "Problemas", atividades: "Atividades", avisos: "Avisos e materiais", perfil: "Meu perfil", equipes: "Equipes",
  admin: "Organização", evento: "Configurações", eventos: "Eventos", pessoas: "Pessoas", entregas: "Entregas", conteudo: "Avisos e materiais",
  avaliacao: "Avaliação", resultados: "Resultados", auditoria: "Registro de alterações",
};

interface MyEvents { currentId: string | null; events: { id: string; name: string; slug: string; status: string; role: string }[] }

/** Seletor de evento (como o seletor de workspace): muda o evento ativo de todas as telas. */
function EventSwitcher({ role, onDone }: { role: Role; onDone: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ["my-events"], queryFn: () => get<MyEvents>("/me/events") });
  useEffect(() => { if (data?.currentId) setActiveEventId(data.currentId); }, [data?.currentId]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const current = data?.events.find((e) => e.id === data.currentId);

  const choose = (id: string) => {
    activateEvent(qc, id);
    setOpen(false);
    nav(role === "organizer" ? "/app/admin" : role === "mentor" ? "/app/equipes" : "/app");
    onDone();
  };

  return (
    <div ref={ref} className="relative mx-3 mb-3">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-subtle">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand"><CalendarDays className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{current?.name ?? "Selecione um evento"}</span><span className="block text-[11px] text-muted">Evento ativo</span></span>
        <ChevronsUpDown className="size-4 text-muted" aria-hidden />
      </button>
      {open && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-2xl">
          {(data?.events ?? []).map((e) => (
            <li key={e.id}><button role="option" aria-selected={e.id === data?.currentId} onClick={() => choose(e.id)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-subtle">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{e.name}</span><span className="block text-[11px] text-muted">{e.role === "organizer" ? "organização" : e.role === "mentor" ? "mentor" : "estudante"} · {e.status}</span></span>
              {e.id === data?.currentId && <Check className="size-4 text-accent" aria-hidden />}
            </button></li>
          ))}
          {(data?.events.length ?? 0) === 0 && <li className="px-3 py-2 text-sm text-muted">Nenhum evento ainda.</li>}
          <li className="mt-1 border-t border-line pt-1"><Link to={role === "organizer" ? "/app/admin/eventos" : "/app/eventos"} onClick={() => { setOpen(false); onDone(); }} className="block rounded-md px-3 py-2 text-sm font-medium no-underline hover:bg-subtle">{role === "organizer" ? "Gerenciar eventos" : "Meus eventos"}</Link></li>
        </ul>
      )}
    </div>
  );
}

export function AppShell() {
  const { me } = useMe();
  const logout = useLogout();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ["my-events"], queryFn: () => get<MyEvents>("/me/events") });
  if (!me) return null;
  const currentName = data?.events.find((e) => e.id === data.currentId)?.name;

  const parts = loc.pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean).filter((p) => !/^[0-9a-f-]{36}$/.test(p));
  const trail = parts.length ? parts.map((p) => crumbs[p] ?? p) : [me.role === "student" ? "Painel" : "Início"];
  const chip = (
    <>
      <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-fg">{me.displayName.slice(0, 1).toUpperCase()}</span>
      <span className="hidden text-sm leading-tight sm:block"><span className="block font-medium">{me.displayName}</span><span className="block text-xs text-muted">{roleLabel[me.role]}</span></span>
    </>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5"><Link to="/" className="no-underline" aria-label="Eventos"><Logo /></Link></div>
      <EventSwitcher role={me.role} onDone={() => setOpen(false)} />
      <SideNav role={me.role} onNavigate={() => setOpen(false)} />
      <div className="border-t border-line p-3">
        <button onClick={logout} className="flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-subtle hover:text-ink">
          <LogOut className="size-[18px]" aria-hidden /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[256px_1fr]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">Ir para o conteúdo</a>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-canvas lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-canvas">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-md p-2 text-muted hover:bg-subtle" aria-label="Fechar menu"><X className="size-5" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-8">
          <button onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-md border border-line bg-surface lg:hidden" aria-label="Abrir menu"><Menu className="size-5" /></button>
          <PanelLeft className="hidden size-4 text-muted lg:block" aria-hidden />
          <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden truncate text-muted sm:block">{currentName ?? "Evento"}</span>
            {trail.map((t, i) => (<span key={i} className="flex items-center gap-2"><span className="hidden text-muted sm:block">/</span><span className={cn("truncate", i === trail.length - 1 ? "font-medium text-ink" : "hidden text-muted sm:block")}>{t}</span></span>))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle className="hidden sm:inline-flex" />
            {me.role !== "organizer" && <Link to="/app/avisos" className="relative grid size-9 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-subtle" aria-label="Avisos"><Bell className="size-[18px]" /></Link>}
            {/* perfil com ticket só para estudantes; mentores e organização têm um perfil prático (sem link) */}
            {me.role === "student"
              ? <Link to="/app/perfil" className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-1 no-underline hover:bg-subtle sm:pr-3">{chip}</Link>
              : <div className="flex items-center gap-2.5 py-1 pr-1 pl-1 sm:pr-3">{chip}</div>}
          </div>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl p-4 sm:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
