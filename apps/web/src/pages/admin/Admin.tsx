import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Empty, PageHeader, PageLoading, Stat, StatGroup } from "@/components/ui/misc";
import { activateEvent, api, errorMessage, exportUrl, get } from "@/lib/api";
import { fmtDateTime, toLocalInput } from "@/lib/utils";

export function AdminOverview() {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: () => get<{ students: number; teams: number; withoutTeam: number; finalDeliveries: number }>("/admin/overview") });
  const un = useQuery({ queryKey: ["admin", "unassigned"], queryFn: () => get<{ users: { id: string; name: string; school: string | null }[] }>("/admin/unassigned") });
  const teams = useQuery({ queryKey: ["admin", "teams"], queryFn: () => get<{ teams: { id: string; name: string; members: unknown[] }[] }>("/admin/teams") });
  const qc = useQueryClient();
  const move = useMutation({
    mutationFn: (v: { userId: string; teamId: string }) => api.patch("/admin/members", v),
    onSuccess: () => { toast.success("Estudante alocado."); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading || !q.data) return <PageLoading />;
  const d = q.data;
  const exports = [["participants", "Inscritos"], ["teams", "Equipes"], ["submissions", "Entregas"], ["results", "Resultados"]];
  return (
    <>
      <PageHeader title="Visão geral" subtitle="Acompanhe inscrições, equipes e entregas do evento." />
      <StatGroup>
        <Stat label="Estudantes inscritos" tone="indigo" value={d.students} /><Stat label="Equipes" tone="violet" value={d.teams} />
        <Stat label="Sem equipe" tone="slate" value={d.withoutTeam} /><Stat label="Entregas finais" tone="green" value={d.finalDeliveries} />
      </StatGroup>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="sem"><h2 id="sem" className="mb-3 text-lg">Estudantes sem equipe</h2>
          {(un.data?.users.length ?? 0) === 0 ? <Empty icon={<CheckCircle2 className="size-5" />} title="Todos os estudantes têm equipe" /> : (
            <ul className="divide-y divide-line">{un.data!.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{u.school || "—"}</span></span>
                <Select aria-label={`Alocar ${u.name}`} className="h-9 w-44" value="" onChange={(e) => e.target.value && move.mutate({ userId: u.id, teamId: e.target.value })}>
                  <option value="">Alocar em…</option>{teams.data?.teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.members.length})</option>)}</Select></li>
            ))}</ul>
          )}
        </section>
        <section className="card"><h2 className="mb-3 text-lg">Exportações</h2>
          <div className="grid gap-2 sm:grid-cols-2">{exports.map(([k, l]) => <Button key={k} asChild variant="outline"><a href={exportUrl(`/api/admin/export/${k}.csv`)}><Download /> {l} (CSV)</a></Button>)}</div>
          <p className="mt-3 text-xs text-muted">Os materiais de cada equipe são baixados em ZIP na tela Equipes. </p></section>
      </div>
    </>
  );
}

export function AdminEvent() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [delOpen, setDelOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const q = useQuery({ queryKey: ["admin", "event"], queryFn: () => get<{ event: Record<string, any> }>("/admin/event") });
  const [f, setF] = useState<Record<string, any>>({});
  useEffect(() => { if (q.data) setF({ ...q.data.event, startsAt: toLocalInput(q.data.event.startsAt), endsAt: toLocalInput(q.data.event.endsAt), problemsPublishedAt: toLocalInput(q.data.event.problemsPublishedAt), teamFormationDeadline: toLocalInput(q.data.event.teamFormationDeadline), scheduleText: JSON.stringify(q.data.event.schedule, null, 1), faqText: JSON.stringify(q.data.event.faq, null, 1) }); }, [q.data]);
  const save = useMutation({
    mutationFn: () => {
      const d = (v: string) => (v ? new Date(v).toISOString() : null);
      return api.patch("/admin/event", {
        slug: f.slug, name: f.name, description: f.description, location: f.location, startsAt: d(f.startsAt) ?? undefined, endsAt: d(f.endsAt) ?? undefined,
        registrationOpen: !!f.registrationOpen, minTeamSize: Number(f.minTeamSize), maxTeamSize: Number(f.maxTeamSize), allowMixedClasses: !!f.allowMixedClasses,
        problemMode: f.problemMode, maxTeamsPerProblem: f.maxTeamsPerProblem ? Number(f.maxTeamsPerProblem) : null,
        problemsPublishedAt: d(f.problemsPublishedAt), teamFormationDeadline: d(f.teamFormationDeadline), maxFileMb: Number(f.maxFileMb),
        rulesUrl: f.rulesUrl || null, schedule: JSON.parse(f.scheduleText || "[]"), faq: JSON.parse(f.faqText || "[]"),
      });
    },
    onSuccess: () => { toast.success("Evento atualizado."); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["my-events"] }); },
    onError: (e) => toast.error(e instanceof SyntaxError ? "Programação/FAQ: JSON inválido" : errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => api.delete("/admin/event", { data: { confirm: confirmName } }),
    onSuccess: () => {
      toast.success("Evento excluído.");
      setDelOpen(false);
      activateEvent(qc, null);
      nav("/app/admin/eventos", { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!q.data) return <PageLoading />;
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  return (
    <>
      <PageHeader title="Evento" subtitle="Informações exibidas na página pública e regras de equipes." actions={<Button onClick={() => save.mutate()} loading={save.isPending}>Salvar alterações</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4"><h2 className="text-lg">Informações</h2>
          <Field label="Nome" htmlFor="n"><Input id="n" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Endereço da página do evento" htmlFor="sl" hint={`${location.origin}/e/${f.slug ?? ""}`}><Input id="sl" value={f.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></Field>
          <Field label="Descrição" htmlFor="d"><Textarea id="d" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Local" htmlFor="l"><Input id="l" value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Início" htmlFor="s"><Input id="s" type="datetime-local" value={f.startsAt ?? ""} onChange={(e) => set("startsAt", e.target.value)} /></Field><Field label="Fim" htmlFor="e"><Input id="e" type="datetime-local" value={f.endsAt ?? ""} onChange={(e) => set("endsAt", e.target.value)} /></Field></div>
          <Field label="Link do regulamento" htmlFor="r"><Input id="r" value={f.rulesUrl ?? ""} onChange={(e) => set("rulesUrl", e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--ink)]" checked={!!f.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} /> Inscrições abertas</label>
        </section>
        <section className="card space-y-4"><h2 className="text-lg">Equipes, problemas e arquivos</h2>
          <div className="grid grid-cols-2 gap-3"><Field label="Mín. de integrantes" htmlFor="mi"><Input id="mi" type="number" value={f.minTeamSize ?? ""} onChange={(e) => set("minTeamSize", e.target.value)} /></Field><Field label="Máx. de integrantes" htmlFor="ma"><Input id="ma" type="number" value={f.maxTeamSize ?? ""} onChange={(e) => set("maxTeamSize", e.target.value)} /></Field></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-[var(--ink)]" checked={!!f.allowMixedClasses} onChange={(e) => set("allowMixedClasses", e.target.checked)} /> Permitir equipes com turmas diferentes</label>
          <Field label="Prazo de formação das equipes" htmlFor="pf"><Input id="pf" type="datetime-local" value={f.teamFormationDeadline ?? ""} onChange={(e) => set("teamFormationDeadline", e.target.value)} /></Field>
          <Field label="Escolha do problema" htmlFor="pm"><Select id="pm" value={f.problemMode ?? "free"} onChange={(e) => set("problemMode", e.target.value)}><option value="free">Livre (a equipe escolhe)</option><option value="assigned">Atribuído pela organização</option></Select></Field>
          <Field label="Limite de equipes por problema" htmlFor="lp" hint="Vazio = sem limite."><Input id="lp" type="number" value={f.maxTeamsPerProblem ?? ""} onChange={(e) => set("maxTeamsPerProblem", e.target.value)} /></Field>
          <Field label="Divulgação dos problemas" htmlFor="pp"><Input id="pp" type="datetime-local" value={f.problemsPublishedAt ?? ""} onChange={(e) => set("problemsPublishedAt", e.target.value)} /></Field>
          <Field label="Tamanho máximo por arquivo (MB)" htmlFor="mf"><Input id="mf" type="number" value={f.maxFileMb ?? ""} onChange={(e) => set("maxFileMb", e.target.value)} /></Field>
        </section>
        <section className="card space-y-4 lg:col-span-2"><h2 className="text-lg">Programação e perguntas frequentes</h2>
          <Field label="Programação (JSON: day, time, title, description)" htmlFor="sc"><Textarea id="sc" className="min-h-40 font-mono text-xs" value={f.scheduleText ?? ""} onChange={(e) => set("scheduleText", e.target.value)} /></Field>
          <Field label="FAQ (JSON: q, a)" htmlFor="fq"><Textarea id="fq" className="min-h-32 font-mono text-xs" value={f.faqText ?? ""} onChange={(e) => set("faqText", e.target.value)} /></Field></section>
        <section className="card space-y-3 border-danger/40 lg:col-span-2" aria-labelledby="perigo">
          <h2 id="perigo" className="text-lg text-danger">Zona de perigo</h2>
          <p className="text-sm text-muted">Excluir o evento apaga equipes, entregas, arquivos, atividades, problemas e avaliações dele. As contas das pessoas continuam existindo. Esta ação não pode ser desfeita.</p>
          <div><Button variant="danger" onClick={() => { setConfirmName(""); setDelOpen(true); }}><Trash2 /> Excluir este evento</Button></div>
        </section>
      </div>
      <Modal open={delOpen} onOpenChange={setDelOpen} title="Excluir evento" description="Isso é permanente. Para confirmar, digite o nome do evento.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); del.mutate(); }}>
          <p className="rounded-lg border border-line bg-subtle p-3 text-sm font-medium">{f.name}</p>
          <Field label="Digite o nome do evento" htmlFor="delname"><Input id="delname" autoComplete="off" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="ghost" onClick={() => setDelOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={del.isPending} disabled={confirmName.trim() !== (f.name ?? "")}>Excluir definitivamente</Button></div>
        </form>
      </Modal>
    </>
  );
}

interface Matrix { activities: { id: string; title: string; dueAt: string; required: boolean }[]; teams: { id: string; name: string; cells: { activityId: string; submissionId: string | null; state: string | null; situation: "concluida" | "atrasada" | "pendente"; verified: boolean; brokenLinks: number }[] }[] }
export function AdminSubmissions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "submissions"], queryFn: () => get<Matrix>("/admin/submissions") });
  const [reopen, setReopen] = useState<{ activityId: string; teamId: string; submissionId: string | null; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [due, setDue] = useState("");
  const verify = useMutation({ mutationFn: (id: string) => api.post(`/admin/submissions/${id}/verify`), onSuccess: () => { toast.success("Marcada como conferida."); qc.invalidateQueries({ queryKey: ["admin", "submissions"] }); }, onError: (e) => toast.error(errorMessage(e)) });
  const doReopen = useMutation({
    mutationFn: () => api.post(reopen!.submissionId ? `/admin/submissions/${reopen!.submissionId}/reopen` : `/admin/activities/${reopen!.activityId}/reopen/${reopen!.teamId}`, { reason, newDueAt: new Date(due).toISOString() }),
    onSuccess: () => { toast.success("Entrega reaberta e registrada."); setReopen(null); setReason(""); qc.invalidateQueries({ queryKey: ["admin", "submissions"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading || !q.data) return <PageLoading />;
  const tone = { concluida: "success", atrasada: "danger", pendente: "warn" } as const;
  const label = { concluida: "Concluída", atrasada: "Atrasada", pendente: "Pendente" };
  return (
    <>
      <PageHeader title="Entregas" subtitle="Concluídas, pendentes e atrasadas por equipe. Conferir é diferente de apenas receber." actions={<Button asChild variant="outline"><a href={exportUrl("/api/admin/export/submissions.csv")}><Download /> Exportar CSV</a></Button>} />
      {q.data.teams.length === 0 ? <Empty title="Sem equipes ainda" /> : (
        <div className="card overflow-x-auto !p-0"><table className="w-full text-left text-sm">
          <thead className="bg-subtle text-xs text-muted"><tr><th className="sticky left-0 bg-subtle px-4 py-3 font-medium">Equipe</th>{q.data.activities.map((a) => <th key={a.id} className="min-w-40 px-4 py-3 font-medium">{a.title}<span className="block font-normal">{fmtDateTime(a.dueAt)}</span></th>)}</tr></thead>
          <tbody className="divide-y divide-line">{q.data.teams.map((t) => (
            <tr key={t.id}><th className="sticky left-0 bg-surface px-4 py-3 font-medium">{t.name}</th>{t.cells.map((c) => (
              <td key={c.activityId} className="px-4 py-3 align-top"><Badge tone={tone[c.situation]}>{label[c.situation]}</Badge>
                {c.verified && <span className="mt-1 flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> Conferida</span>}
                {c.brokenLinks > 0 && <span className="mt-1 flex items-center gap-1 text-xs text-danger"><AlertTriangle className="size-3.5" /> {c.brokenLinks} link(s) inacessível(is)</span>}
                <div className="mt-2 flex gap-1">{c.submissionId && c.state !== "draft" && !c.verified && <Button size="sm" variant="outline" onClick={() => verify.mutate(c.submissionId!)}>Conferir</Button>}
                  {c.situation !== "concluida" || c.state === "final_confirmed" ? <Button size="sm" variant="ghost" aria-label="Reabrir" onClick={() => { setReopen({ activityId: c.activityId, teamId: t.id, submissionId: c.submissionId, name: t.name }); setDue(""); }}><RotateCcw /></Button> : null}</div></td>
            ))}</tr>
          ))}</tbody></table></div>
      )}
      <Modal open={!!reopen} onOpenChange={(o) => !o && setReopen(null)} title="Reabrir entrega" description={`Equipe ${reopen?.name}. A reabertura fica registrada com justificativa e novo prazo.`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); doReopen.mutate(); }}>
          <Field label="Justificativa" htmlFor="rj" required><Textarea id="rj" className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Field label="Novo prazo" htmlFor="rd" required><Input id="rd" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="ghost" onClick={() => setReopen(null)}>Cancelar</Button><Button type="submit" loading={doReopen.isPending} disabled={reason.trim().length < 5 || !due}>Reabrir</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function AdminResults() {
  const q = useQuery({ queryKey: ["admin", "results"], queryFn: () => get<{ results: { teamId: string; team: string; judges: number; score: number | null }[] }>("/admin/results") });
  if (q.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader title="Resultados" subtitle="Nota ponderada (0–100) pela média dos avaliadores, conforme pesos dos critérios." actions={<Button asChild variant="outline"><a href={exportUrl("/api/admin/export/results.csv")}><Download /> Exportar CSV</a></Button>} />
      {(q.data?.results.length ?? 0) === 0 ? <Empty title="Sem avaliações ainda" /> : (
        <div className="card !p-0"><ol className="divide-y divide-line">{q.data!.results.map((r, i) => (
          <li key={r.teamId} className="flex items-center gap-4 px-5 py-4"><span className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{i + 1}</span><span className="flex-1 font-medium">{r.team}<span className="block text-xs font-normal text-muted">{r.judges} avaliador(es)</span></span><span className="text-xl font-semibold">{r.score ?? "—"}</span></li>
        ))}</ol></div>
      )}
    </>
  );
}

export function AdminAudit() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: () => get<{ entries: { id: string; actor: string | null; action: string; entity: string; entityId: string | null; createdAt: string }[] }>("/admin/audit") });
  if (q.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader title="Registro de alterações" subtitle="Últimas 200 ações importantes (reaberturas, equipes, avaliações, permissões)." />
      <div className="card overflow-x-auto !p-0"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-subtle text-xs text-muted"><tr><th className="px-5 py-3 font-medium">Quando</th><th className="px-5 py-3 font-medium">Quem</th><th className="px-5 py-3 font-medium">Ação</th><th className="px-5 py-3 font-medium">Item</th></tr></thead>
        <tbody className="divide-y divide-line">{q.data?.entries.map((e) => <tr key={e.id}><td className="px-5 py-2.5">{fmtDateTime(e.createdAt)}</td><td className="px-5 py-2.5">{e.actor ?? "—"}</td><td className="px-5 py-2.5 font-mono text-xs">{e.action}</td><td className="px-5 py-2.5 text-xs text-muted">{e.entity} {e.entityId?.slice(0, 8)}</td></tr>)}</tbody></table></div>
    </>
  );
}
