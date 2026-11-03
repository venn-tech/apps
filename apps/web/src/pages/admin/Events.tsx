import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, ExternalLink, FileArchive, MapPin, Plus, UserPlus, Users, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { eventRoles } from "@hackaton/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Avatar, Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { api, errorMessage, exportUrl, get, setActiveEventId, activateEvent, apiUrl } from "@/lib/api";
import { fmtRange } from "@/lib/utils";

type Role = (typeof eventRoles)[number];
const roleLabel: Record<Role, string> = { student: "Estudante", mentor: "Mentor" };

interface EventCard { id: string; slug: string; name: string; location: string; startsAt: string | null; endsAt: string | null; registrationOpen: boolean; students: number; mentors: number; teams: number }
const useEvents = () => useQuery({ queryKey: ["admin", "events"], queryFn: () => get<{ events: EventCard[] }>("/admin/events") });

function Counters({ e }: { e: EventCard }) {
  return (
    <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg border border-line text-center">
      {([["Estudantes", e.students], ["Equipes", e.teams], ["Mentores", e.mentors]] as const).map(([k, v]) => (
        <div key={k} className="px-2 py-2.5"><dd className="font-display text-xl font-extrabold">{v}</dd><dt className="text-[11px] text-muted">{k}</dt></div>
      ))}
    </dl>
  );
}

/** Lista de eventos + criação de novos eventos (cada um com a sua URL). */
export function AdminEvents() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useEvents();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", slug: "", location: "", startsAt: "", endsAt: "", description: "" });
  const create = useMutation({
    mutationFn: () => api.post<{ event: { id: string } }>("/admin/events", {
      name: f.name, slug: f.slug || undefined, location: f.location, description: f.description,
      startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined, endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
    }).then((r) => r.data.event),
    onSuccess: (e) => {
      toast.success("Evento criado!");
      setOpen(false); setF({ name: "", slug: "", location: "", startsAt: "", endsAt: "", description: "" });
      activateEvent(qc, e.id);
      nav("/app/admin/evento");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const select = (id: string) => {
    activateEvent(qc, id);
    nav("/app/admin");
  };
  if (q.isLoading) return <PageLoading />;
  const events = q.data?.events ?? [];
  return (
    <>
      <PageHeader title="Eventos" subtitle="Cada evento tem a sua página, equipes, atividades e avaliação." actions={<Button variant="brand" onClick={() => setOpen(true)}><Plus /> Novo evento</Button>} />
      {events.length === 0 ? <Empty title="Nenhum evento criado" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <article key={e.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg">{e.name}</h2>{e.registrationOpen ? <Badge tone="success">Inscrições abertas</Badge> : <Badge>Encerradas</Badge>}</div>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted"><CalendarDays className="size-4" aria-hidden />{fmtRange(e.startsAt, e.endsAt)}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted"><MapPin className="size-4" aria-hidden />{e.location || "Local a definir"}</p>
              <a href={`/e/${e.slug}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand no-underline hover:underline"><ExternalLink className="size-3.5" aria-hidden />/e/{e.slug}</a>
              <Counters e={e} />
              <div className="mt-auto flex gap-2 pt-4"><Button size="sm" variant="primary" onClick={() => select(e.id)}>Gerenciar</Button>
                <Button asChild size="sm" variant="outline"><Link to={`/app/admin/pessoas/${e.id}`}><Users /> Pessoas</Link></Button></div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Novo evento" description="Você poderá ajustar tudo depois em Configurações.">
        <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); create.mutate(); }}>
          <Field label="Nome" htmlFor="en" required><Input id="en" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Endereço da página (opcional)" htmlFor="es" hint={`${location.origin}/e/${f.slug || "gerado-a-partir-do-nome"}`}><Input id="es" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Início" htmlFor="ei"><Input id="ei" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></Field><Field label="Fim" htmlFor="ef"><Input id="ef" type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field></div>
          <Field label="Local" htmlFor="el"><Input id="el" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Descrição" htmlFor="ed"><Textarea id="ed" className="min-h-20" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="brand" loading={create.isPending} disabled={f.name.trim().length < 3}>Criar evento</Button></div>
        </form>
      </Modal>
    </>
  );
}

/** Pessoas: um card por evento; cada card leva à lista de membros do evento. */
export function AdminPeople() {
  const q = useEvents();
  if (q.isLoading) return <PageLoading />;
  const events = q.data?.events ?? [];
  return (
    <>
      <PageHeader title="Pessoas" subtitle="Escolha um evento para ver e gerenciar quem participa dele." />
      {events.length === 0 ? <Empty title="Nenhum evento criado" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} to={`/app/admin/pessoas/${e.id}`} className="card group no-underline transition hover:border-accent/60">
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg">{e.name}</h2><ArrowUpRight className="size-5 text-muted transition group-hover:text-accent" aria-hidden /></div>
              <p className="mt-1 text-sm text-muted">{fmtRange(e.startsAt, e.endsAt)}</p>
              <Counters e={e} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

interface Member { id: string; email: string; fullName: string; displayName: string; role: Role; school: string | null; accessibilityNeeds: string | null; joinedAt: string; teamName: string | null }

export function AdminEventMembers() {
  const { eventId = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "members", eventId], queryFn: () => get<{ event: { id: string; name: string; slug: string }; members: Member[] }>(`/admin/events/${eventId}/members`) });
  const [filter, setFilter] = useState("");
  const [role, setRoleFilter] = useState<"" | Role>("");
  const [email, setEmail] = useState("");
  const [addRole, setAddRole] = useState<Role>("student");
  const done = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const setRole = useMutation({ mutationFn: (v: { id: string; role: Role }) => api.patch(`/admin/events/${eventId}/members/${v.id}/role`, { role: v.role }), onSuccess: () => { toast.success("Perfil atualizado."); done(); }, onError });
  const add = useMutation({ mutationFn: () => api.post(`/admin/events/${eventId}/members`, { email, role: addRole }), onSuccess: () => { toast.success("Pessoa adicionada ao evento."); setEmail(""); done(); }, onError });
  const remove = useMutation({ mutationFn: (userId: string) => api.delete(`/admin/events/${eventId}/members/${userId}`), onSuccess: () => { toast.success("Removida do evento."); done(); }, onError });
  if (q.isLoading || !q.data) return <PageLoading />;
  const members = q.data.members.filter((m) => (!role || m.role === role) && (m.fullName + m.email).toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <PageHeader back={{ to: "/app/admin/pessoas", label: "Pessoas" }} title={q.data.event.name} subtitle={`${q.data.members.length} pessoa(s) neste evento.`}
        actions={<Button asChild variant="outline"><a href={apiUrl(`/api/admin/export/participants.csv?eventId=${eventId}`)}>Exportar CSV</a></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input aria-label="Buscar pessoa" placeholder="Buscar por nome ou e-mail" className="max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Select aria-label="Filtrar por papel" className="w-44" value={role} onChange={(e) => setRoleFilter(e.target.value as "" | Role)}><option value="">Todos os papéis</option>{eventRoles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</Select>
        <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <Input aria-label="E-mail da pessoa" type="email" placeholder="Adicionar por e-mail (conta existente)" className="w-64" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select aria-label="Papel neste evento" className="w-36" value={addRole} onChange={(e) => setAddRole(e.target.value as Role)}>{eventRoles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</Select>
          <Button type="submit" variant="brand" loading={add.isPending} disabled={!email}><UserPlus /> Adicionar</Button>
        </form>
      </div>
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-subtle text-xs text-muted"><tr><th className="px-5 py-3 font-medium">Nome</th><th className="px-5 py-3 font-medium">Escola/turma</th><th className="px-5 py-3 font-medium">Acessibilidade</th><th className="px-5 py-3 font-medium">Equipe</th><th className="px-5 py-3 font-medium">Papel neste evento</th><th className="px-5 py-3"><span className="sr-only">Ações</span></th></tr></thead>
        <tbody className="divide-y divide-line">{members.map((m) => (
          <tr key={m.id}><td className="px-5 py-3"><span className="flex items-center gap-3"><Avatar /><span><span className="block font-medium">{m.fullName}</span><span className="block text-xs text-muted">{m.email}</span></span></span></td><td className="px-5 py-3">{m.school || "—"}</td><td className="px-5 py-3">{m.accessibilityNeeds || "—"}</td>
            <td className="px-5 py-3">{m.role === "student" ? (m.teamName ? <Badge tone="success">{m.teamName}</Badge> : <Badge tone="warn">Sem equipe</Badge>) : "—"}</td>
            <td className="px-5 py-3"><Select aria-label={`Perfil de ${m.fullName}`} className="h-9 w-36" value={m.role} onChange={(e) => setRole.mutate({ id: m.id, role: e.target.value as Role })}>{eventRoles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}</Select></td>
            <td className="px-5 py-3 text-right"><Button size="sm" variant="danger" onClick={() => confirm(`Remover ${m.fullName} deste evento?`) && remove.mutate(m.id)}>Remover</Button></td></tr>
        ))}</tbody></table>
        {members.length === 0 && <div className="p-6"><Empty title="Ninguém encontrado" /></div>}
      </div>
      <p className="mt-3 text-xs text-muted">O papel vale apenas para este evento: a mesma pessoa pode ser estudante em um evento e mentora em outro.</p>
    </>
  );
}

interface AdminTeam { id: string; name: string; description: string; problem: string | null; inviteCode: string; submitted: number; finalConfirmed: boolean; members: { userId: string; name: string; email: string }[] }

/** Equipes do evento ativo (reúne o antigo "Ver equipes" e "Equipes"). */
export function AdminTeams() {
  const qc = useQueryClient();
  const teams = useQuery({ queryKey: ["admin", "teams"], queryFn: () => get<{ teams: AdminTeam[] }>("/admin/teams") });
  const problems = useQuery({ queryKey: ["admin", "problems"], queryFn: () => get<{ items: { id: string; title: string }[] }>("/admin/problems") });
  const done = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const setProblem = useMutation({ mutationFn: (v: { id: string; problemId: string | null }) => api.patch(`/admin/teams/${v.id}/problem`, { problemId: v.problemId }), onSuccess: () => { toast.success("Problema definido."); done(); }, onError });
  const removeMember = useMutation({ mutationFn: (userId: string) => api.patch("/admin/members", { userId, teamId: null }), onSuccess: done, onError });
  if (teams.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader title="Equipes" subtitle="Acompanhe os grupos, abra o trabalho de cada equipe, ajuste integrantes e defina problemas." actions={<Button asChild variant="outline"><a href={exportUrl("/api/admin/export/teams.csv")}>Exportar CSV</a></Button>} />
      {(teams.data?.teams.length ?? 0) === 0 ? <Empty icon={<UsersRound className="size-5" />} title="Nenhuma equipe criada ainda" /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.data!.teams.map((t) => (
            <section key={t.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="text-lg">{t.name}</h2><p className="text-xs text-muted">{t.members.length} integrante(s) · {t.submitted} envio(s){t.finalConfirmed && " · entrega final confirmada"}</p></div>
                <div className="flex gap-2"><Button asChild size="sm" variant="primary"><Link to={`/app/equipes/${t.id}`}>Abrir trabalho</Link></Button>
                  <Button asChild size="sm" variant="outline"><a href={apiUrl(`/api/admin/export/team/${t.id}.zip`)}><FileArchive /> ZIP</a></Button></div>
              </div>
              <ul className="flex flex-wrap gap-2">{t.members.map((m) => <li key={m.userId} title={m.email} className="inline-flex items-center gap-2 rounded-full bg-subtle py-1 pr-1 pl-1 text-sm"><Avatar size="sm" />{m.name}<button aria-label={`Remover ${m.name}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-line" onClick={() => confirm(`Remover ${m.name} da equipe?`) && removeMember.mutate(m.userId)}>×</button></li>)}</ul>
              <Field label="Problema" htmlFor={`p-${t.id}`}><Select id={`p-${t.id}`} value={problems.data?.items.find((p) => p.title === t.problem)?.id ?? ""} onChange={(e) => setProblem.mutate({ id: t.id, problemId: e.target.value || null })}><option value="">Nenhum</option>{problems.data?.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select></Field>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
