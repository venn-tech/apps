import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar, Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { fmtDateTime, fmtSize } from "@/lib/utils";

interface StaffTeam { id: string; name: string; problem: string | null; submitted: number; members: string[] }

export function StaffTeams() {
  const q = useQuery({ queryKey: ["staff-teams"], queryFn: () => get<{ teams: StaffTeam[] }>("/staff/teams") });
  if (q.isLoading) return <PageLoading />;
  const teams = q.data?.teams ?? [];
  return (
    <>
      <PageHeader title="Equipes" subtitle="Equipes do evento. A mentoria acontece de mesa em mesa; aqui você vê o que foi entregue e preenche a avaliação." />
      {teams.length === 0 ? <Empty title="Nenhuma equipe ainda">As equipes aparecem aqui quando os estudantes as criarem.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Link key={t.id} to={`/app/equipes/${t.id}`} className="card text-ink no-underline transition hover:ring-2 hover:ring-brand/20">
              <h2 className="text-lg">{t.name}</h2><p className="mt-1 text-sm text-muted">{t.problem ?? "Sem problema definido"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="brand">{t.submitted} entrega(s)</Badge></div>
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted">{t.members.map((m) => <li key={m} className="flex items-center gap-1.5"><Avatar size="sm" className="!size-5" />{m}</li>)}</ul>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

interface Delivered { version: number; kind: string; deliveredAt: string; text: string; links: { url: string; label?: string }[]; files: { id: string; name: string; sizeBytes: number }[]; verified: boolean }
interface TeamWork {
  team: { id: string; name: string; description: string }; problem: { title: string; question: string } | null;
  members: { name: string; fullName: string; email: string }[];
  work: { activity: { id: string; title: string; kind: string; dueAt: string }; delivered: Delivered | null }[];
  notes: { id: string; body: string; mentor: string; createdAt: string }[];
}
interface Criterion { id: string; name: string; description: string; weight: number; maxScore: number }

export function StaffTeamDetail() {
  const { id = "" } = useParams();
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff-team", id], queryFn: () => get<TeamWork>(`/staff/teams/${id}`) });
  const [note, setNote] = useState("");
  const addNote = useMutation({
    mutationFn: () => api.post(`/staff/teams/${id}/notes`, { body: note }),
    onSuccess: () => { toast.success("Orientação registrada."); setNote(""); qc.invalidateQueries({ queryKey: ["staff-team", id] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const dl = async (fid: string) => { try { window.open((await get<{ url: string }>(`/files/${fid}/download`)).url, "_blank", "noopener"); } catch (e) { toast.error(errorMessage(e)); } };

  if (q.isLoading || !q.data) return <PageLoading />;
  const d = q.data;
  const canEvaluate = me?.role === "mentor"; // mentor = mentoria + banca
  return (
    <>
      <Link to="/app/equipes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-ink"><ArrowLeft className="size-4" /> Equipes</Link>
      <PageHeader title={d.team.name} subtitle={d.problem ? `${d.problem.title} — ${d.problem.question}` : "Sem problema definido"} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs text-muted">Aparece apenas o que a equipe <strong className="text-ink">entregou</strong>. Rascunhos não são exibidos nem avaliados.</p>
          {d.work.map(({ activity, delivered }) => (
            <section key={activity.id} className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-base">{activity.title}</h2>
                {delivered ? <Badge tone={delivered.verified ? "success" : "brand"}>{delivered.kind === "final" ? "Entrega final" : "Entregue"} · v{delivered.version}</Badge> : <Badge>Ainda não entregue</Badge>}</div>
              {delivered ? (
                <>
                  <p className="mb-2 text-xs text-muted">Entregue em {fmtDateTime(delivered.deliveredAt)}</p>
                  {delivered.text && <p className="rounded-lg bg-subtle p-3 text-sm whitespace-pre-line">{delivered.text}</p>}
                  {delivered.links.map((l) => <p key={l.url} className="mt-2 text-sm"><a href={l.url} target="_blank" rel="noreferrer" className="break-all">{l.url}</a></p>)}
                  {delivered.files.map((f) => <div key={f.id} className="mt-2 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"><span className="truncate">{f.name} <span className="text-xs text-muted">({fmtSize(f.sizeBytes)})</span></span><Button size="icon" variant="ghost" aria-label={`Baixar ${f.name}`} onClick={() => dl(f.id)}><Download /></Button></div>)}
                  {!delivered.text && !delivered.files.length && !delivered.links.length && <p className="text-sm text-muted">Entrega sem conteúdo.</p>}
                </>
              ) : <p className="text-sm text-muted">Nada entregue nesta atividade.</p>}
            </section>
          ))}
        </div>
        <div className="space-y-6">
          <section className="card"><h2 className="mb-3 text-lg">Integrantes</h2><ul className="space-y-3 text-sm">{d.members.map((m) => <li key={m.email} className="flex items-center gap-3"><Avatar /><span><span className="block font-medium">{m.fullName}</span><span className="block text-xs text-muted">{m.email}</span></span></li>)}</ul></section>
          {(
            <section className="card space-y-3"><h2 className="text-lg">Registrar orientação</h2>
              <Textarea aria-label="Orientação" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex justify-end"><Button onClick={() => addNote.mutate()} loading={addNote.isPending} disabled={!note.trim()}><Send /> Registrar</Button></div>
              {d.notes.map((n) => <div key={n.id} className="rounded-xl bg-subtle p-3 text-sm"><p>{n.body}</p><p className="mt-1 text-xs text-muted">{n.mentor} · {fmtDateTime(n.createdAt)}</p></div>)}
            </section>
          )}
          {canEvaluate && <Evaluation teamId={id} />}
        </div>
      </div>
    </>
  );
}

function Evaluation({ teamId }: { teamId: string }) {
  const crit = useQuery({ queryKey: ["criteria"], queryFn: () => get<{ criteria: Criterion[] }>("/staff/criteria") });
  const ev = useQuery({ queryKey: ["evaluation", teamId], queryFn: () => get<{ scores: { criterionId: string; score: number; comment: string }[]; strengths: string; improvements: string }>(`/staff/teams/${teamId}/evaluation`) });
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  useEffect(() => {
    if (!ev.data) return;
    setScores(Object.fromEntries(ev.data.scores.map((s) => [s.criterionId, String(s.score)])));
    setComments(Object.fromEntries(ev.data.scores.map((s) => [s.criterionId, s.comment])));
    setStrengths(ev.data.strengths); setImprovements(ev.data.improvements);
  }, [ev.data]);
  const save = useMutation({
    mutationFn: () => api.put(`/staff/teams/${teamId}/evaluation`, {
      scores: (crit.data?.criteria ?? []).filter((c) => scores[c.id] !== undefined && scores[c.id] !== "").map((c) => ({ criterionId: c.id, score: Number(scores[c.id]), comment: comments[c.id] ?? "" })),
      strengths, improvements,
    }),
    onSuccess: () => toast.success("Avaliação salva."),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section className="card space-y-4"><h2 className="text-lg">Ficha de avaliação</h2>
      {crit.data?.criteria.map((c) => (
        <Field key={c.id} label={`${c.name} (0 a ${c.maxScore})`} htmlFor={`c-${c.id}`} hint={c.description}>
          <Input id={`c-${c.id}`} type="number" min={0} max={c.maxScore} step="0.5" value={scores[c.id] ?? ""} onChange={(e) => setScores({ ...scores, [c.id]: e.target.value })} />
        </Field>
      ))}
      <Field label="Pontos fortes" htmlFor="st"><Textarea id="st" className="min-h-20" value={strengths} onChange={(e) => setStrengths(e.target.value)} /></Field>
      <Field label="Possibilidades de melhoria" htmlFor="im"><Textarea id="im" className="min-h-20" value={improvements} onChange={(e) => setImprovements(e.target.value)} /></Field>
      <div className="flex justify-end border-t border-line pt-4"><Button onClick={() => save.mutate()} loading={save.isPending}>Salvar avaliação</Button></div>
      <p className="text-xs text-muted">Notas e comentários ficam visíveis apenas para a mentoria e a organização.</p>
    </section>
  );
}
