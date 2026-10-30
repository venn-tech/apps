import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, LogOut, Pencil, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar, Empty, PageHeader, PageLoading, SectionTitle } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Team } from "@/lib/types";

interface OpenTeam { id: string; name: string; description: string; members: number; slots: number; requested: boolean }

export default function TeamPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: () => get<{ team: Team | null }>("/teams/mine") });
  const open = useQuery({ queryKey: ["open-teams"], queryFn: () => get<{ teams: OpenTeam[] }>("/teams/open"), enabled: team.data?.team === null });
  const [form, setForm] = useState({ name: "", description: "" });
  const [sp] = useSearchParams();
  const [code, setCode] = useState(sp.get("codigo") ?? "");
  const [edit, setEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [email, setEmail] = useState("");
  const t = team.data?.team ?? null;
  useEffect(() => { if (t) setEditForm({ name: t.name, description: t.description }); }, [t?.name, t?.description]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => { qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: ["open-teams"] }); qc.invalidateQueries({ queryKey: ["activities"] }); };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const create = useMutation({ mutationFn: () => api.post("/teams", form), onSuccess: () => { toast.success("Equipe criada!"); refresh(); }, onError });
  const join = useMutation({ mutationFn: () => api.post("/teams/join-by-code", { code }), onSuccess: () => { toast.success("Você entrou na equipe!"); refresh(); }, onError });
  const request = useMutation({ mutationFn: (id: string) => api.post(`/teams/${id}/requests`), onSuccess: () => { toast.success("Solicitação enviada. Aguarde a resposta da equipe."); refresh(); }, onError });
  const decide = useMutation({ mutationFn: (v: { id: string; d: "accept" | "decline" }) => api.post(`/teams/mine/requests/${v.id}/${v.d}`), onSuccess: refresh, onError });
  const leave = useMutation({ mutationFn: () => api.post("/teams/mine/leave"), onSuccess: () => { toast.success("Você saiu da equipe."); refresh(); }, onError });
  const save = useMutation({ mutationFn: () => api.patch("/teams/mine", editForm), onSuccess: () => { toast.success("Equipe atualizada."); setEdit(false); refresh(); }, onError });
  const addMember = useMutation({ mutationFn: () => api.post("/teams/mine/members", { email }), onSuccess: () => { toast.success("Integrante adicionado."); setEmail(""); refresh(); }, onError });
  const removeMember = useMutation({ mutationFn: (id: string) => api.delete(`/teams/mine/members/${id}`), onSuccess: () => { toast.success("Integrante removido."); refresh(); }, onError });

  if (team.isLoading) return <PageLoading />;

  if (!t) {
    return (
      <>
        <PageHeader title="Formar equipe" subtitle="Cada estudante integra somente uma equipe. Crie a sua, entre por código ou peça para entrar em uma existente." />
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card space-y-4" aria-labelledby="criar">
            <h2 id="criar" className="text-lg">Criar uma equipe</h2>
            <Field label="Nome da equipe" required htmlFor="tn"><Input id="tn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Breve descrição" htmlFor="td"><Textarea id="td" className="min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="flex justify-end border-t border-line pt-4"><Button variant="brand" onClick={() => create.mutate()} loading={create.isPending} disabled={form.name.trim().length < 2}><Plus /> Criar equipe</Button></div>
          </section>
          <section className="card space-y-4" aria-labelledby="codigo">
            <h2 id="codigo" className="text-lg">Entrar com código de convite</h2>
            <Field label="Código" htmlFor="cd" hint="Peça o código para quem criou a equipe."><Input id="cd" className="font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
            <div className="flex justify-end border-t border-line pt-4"><Button variant="brand" onClick={() => join.mutate()} loading={join.isPending} disabled={code.trim().length < 4}>Entrar na equipe</Button></div>
          </section>
          <section className="card lg:col-span-2" aria-labelledby="abertas">
            <h2 id="abertas" className="mb-4 flex items-center gap-2 text-lg"><Search className="size-5 text-brand" aria-hidden /> Equipes com vagas</h2>
            {open.isLoading ? <PageLoading /> : (open.data?.teams.length ?? 0) === 0 ? <Empty title="Nenhuma equipe com vagas">Crie a sua ou fale com a organização.</Empty> : (
              <ul className="divide-y divide-line">
                {open.data!.teams.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="font-medium">{o.name}</p><p className="text-sm text-muted">{o.description || "Sem descrição"} · {o.slots} vaga(s)</p></div>
                    {o.requested ? <Badge tone="warn">Solicitação enviada</Badge> : <Button size="sm" variant="outline" onClick={() => request.mutate(o.id)}>Solicitar entrada</Button>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  const isLeader = t.leaderId === me?.id;
  return (
    <>
      <PageHeader title={t.name} subtitle={t.description || "Equipe sem descrição."}
        actions={<div className="flex gap-2">{isLeader && <Button variant="outline" size="sm" onClick={() => setEdit(!edit)}><Pencil /> Editar equipe</Button>}
          <Button variant="danger" size="sm" onClick={() => confirm("Sair da equipe?") && leave.mutate()}><LogOut /> Sair da equipe</Button></div>} />

      {edit && isLeader && (
        <section className="card mb-6 space-y-4" aria-labelledby="ed">
          <h2 id="ed" className="text-lg">Editar equipe</h2>
          <Field label="Nome da equipe" htmlFor="en"><Input id="en" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
          <Field label="Descrição" htmlFor="edd"><Textarea id="edd" className="min-h-20" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button><Button variant="brand" onClick={() => save.mutate()} loading={save.isPending} disabled={editForm.name.trim().length < 2}>Salvar</Button></div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card" aria-labelledby="int">
          <SectionTitle title={`Integrantes (${t.members.length})`} hint={isLeader ? "Você pode adicionar e remover integrantes pelo e-mail de cadastro." : undefined} />
          <ul className="divide-y divide-line">
            {t.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 py-3">
                <Avatar />
                <div className="min-w-0 flex-1"><p className="font-medium">{m.fullName} {m.userId === t.leaderId && <Badge tone="brand">Líder</Badge>}</p><p className="truncate text-sm text-muted">{m.email}</p></div>
                {isLeader && m.userId !== me?.id && <Button size="icon" variant="danger" aria-label={`Remover ${m.name}`} onClick={() => confirm(`Remover ${m.fullName} da equipe?`) && removeMember.mutate(m.userId)}><X /></Button>}
              </li>
            ))}
          </ul>
          {isLeader && (
            <form className="mt-4 flex gap-2 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); addMember.mutate(); }}>
              <Input aria-label="E-mail do integrante" type="email" placeholder="email@do-colega.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" variant="brand" loading={addMember.isPending} disabled={!email}><Plus /> Adicionar</Button>
            </form>
          )}
        </section>

        <div className="space-y-6">
          {isLeader && t.inviteCode && (
            <section className="card" aria-labelledby="conv">
              <SectionTitle title="Convidar colegas" hint="Compartilhe o código ou o link de convite." />
              <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle p-3"><code className="flex-1 font-mono text-lg font-semibold tracking-widest">{t.inviteCode}</code>
                <Button size="icon" variant="outline" aria-label="Copiar código" onClick={() => { navigator.clipboard.writeText(t.inviteCode!); toast.success("Código copiado"); }}><Copy /></Button></div>
              <Button className="mt-3 w-full" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${location.origin}/app/equipe?codigo=${t.inviteCode}`); toast.success("Link copiado"); }}>Copiar link de convite</Button>
            </section>
          )}
          {isLeader && (
            <section className="card" aria-labelledby="sol">
              <SectionTitle title="Solicitações de entrada" />
              {t.pendingRequests.length === 0 ? <p className="text-sm text-muted">Nenhuma solicitação pendente.</p> : (
                <ul className="space-y-2">
                  {t.pendingRequests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 text-sm">{r.name}
                      <span className="flex gap-1.5"><Button size="icon" variant="success" aria-label={`Aceitar ${r.name}`} onClick={() => decide.mutate({ id: r.id, d: "accept" })}><Check /></Button><Button size="icon" variant="danger" aria-label={`Recusar ${r.name}`} onClick={() => decide.mutate({ id: r.id, d: "decline" })}><X /></Button></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
