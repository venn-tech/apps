import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudUpload, Download, FileText, History, Link2, Plus, RotateCw, Save, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Empty, PageHeader, PageLoading, Progress, SectionTitle, Tabs } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import type { Activity, FileItem, Receipt } from "@/lib/types";
import { fmtDateTime, fmtSize } from "@/lib/utils";
import type { SubmissionStatus } from "@hackaton/shared";

interface Detail {
  activity: Activity; status: SubmissionStatus; verified: boolean;
  submission: { state: "draft" | "submitted" | "final_confirmed"; textAnswer: string; links: { url: string; label?: string }[]; submittedAt: string | null; updatedAt: string } | null;
  files: FileItem[]; removedFiles: FileItem[];
  versions: { version: number; kind: string; createdAt: string; by: string }[];
}
interface Upload { key: string; file: File; progress: number; error?: string }

export default function ActivityDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["activity", id], queryFn: () => get<Detail>(`/activities/${id}`) });
  const [text, setText] = useState("");
  const [links, setLinks] = useState<{ url: string; label?: string }[]>([]);
  const [newLink, setNewLink] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"resposta" | "arquivos" | "links" | "historico">("resposta");
  const localKey = `draft:${id}`;

  // carrega do servidor; se houver rascunho local mais novo (falha de conexão), preserva
  useEffect(() => {
    const d = q.data;
    if (!d) return;
    let local: { text: string; links: { url: string; label?: string }[]; at: number } | null = null;
    try { local = JSON.parse(localStorage.getItem(localKey) ?? "null"); } catch { /* ignora */ }
    const serverAt = d.submission ? new Date(d.submission.updatedAt).getTime() : 0;
    if (local && local.at > serverAt) { setText(local.text); setLinks(local.links); setDirty(true); }
    else { setText(d.submission?.textAnswer ?? ""); setLinks(d.submission?.links ?? []); }
  }, [q.data?.submission?.updatedAt, q.data?.activity.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const locked = q.data ? q.data.status === "closed" || q.data.submission?.state === "final_confirmed" : true;

  const saveDraft = useCallback(async (silent = false) => {
    setSaving("saving");
    try {
      await api.put(`/activities/${id}/draft`, { textAnswer: text, links });
      try { localStorage.removeItem(localKey); } catch { /* ignora */ }
      setDirty(false); setSaving("saved");
      if (!silent) toast.success("Rascunho salvo.");
      qc.invalidateQueries({ queryKey: ["activities"] });
      return true;
    } catch (e) {
      setSaving("error");
      toast.error(errorMessage(e));
      return false;
    }
  }, [id, text, links, localKey, qc]);

  // guarda cópia local a cada mudança e salva automático depois de 2s parado
  useEffect(() => {
    if (!dirty || locked) return;
    try { localStorage.setItem(localKey, JSON.stringify({ text, links, at: Date.now() })); } catch { /* ignora */ }
    const t = setTimeout(() => void saveDraft(true), 2000);
    return () => clearTimeout(t);
  }, [text, links, dirty, locked, localKey, saveDraft]);

  const submit = useMutation({
    mutationFn: async () => { if (dirty && !(await saveDraft(true))) throw new Error("save"); return api.post<{ receipt: Receipt }>(`/activities/${id}/submit`).then((r) => r.data.receipt); },
    onSuccess: (r) => { setReceipt(r); toast.success("Atividade enviada!"); qc.invalidateQueries({ queryKey: ["activity", id] }); qc.invalidateQueries({ queryKey: ["activities"] }); },
    onError: (e) => { if ((e as Error).message !== "save") toast.error(errorMessage(e)); },
  });

  const uploadOne = async (u: Upload) => {
    const body = new FormData();
    body.append("file", u.file);
    try {
      await api.post(`/activities/${id}/files`, body, {
        onUploadProgress: (ev) => setUploads((p) => p.map((x) => (x.key === u.key ? { ...x, progress: ev.total ? (ev.loaded / ev.total) * 100 : 50, error: undefined } : x))),
      });
      setUploads((p) => p.filter((x) => x.key !== u.key));
      toast.success(`"${u.file.name}" recebido.`);
      qc.invalidateQueries({ queryKey: ["activity", id] });
    } catch (e) {
      setUploads((p) => p.map((x) => (x.key === u.key ? { ...x, error: errorMessage(e, "Falha no envio.") } : x)));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const items = [...list].map((file) => ({ key: crypto.randomUUID(), file, progress: 0 }));
    setUploads((p) => [...p, ...items]);
    items.forEach(uploadOne);
  };

  const removeFile = useMutation({
    mutationFn: (fid: string) => api.delete(`/files/${fid}`),
    onSuccess: () => { toast.success("Arquivo removido. O histórico foi preservado."); qc.invalidateQueries({ queryKey: ["activity", id] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const download = async (fid: string) => {
    try { const { url } = await get<{ url: string }>(`/files/${fid}/download`); window.open(url, "_blank", "noopener"); } catch (e) { toast.error(errorMessage(e)); }
  };

  const openReceipt = async (v: number) => {
    try { setReceipt((await get<{ receipt: Receipt }>(`/activities/${id}/receipt/${v}`)).receipt); } catch (e) { toast.error(errorMessage(e)); }
  };

  const checklist = useQuery({ queryKey: ["checklist", id], queryFn: () => get<{ items: { label: string; ok: boolean }[] }>(`/activities/${id}/checklist`), enabled: confirmOpen });
  const confirmFinal = useMutation({
    mutationFn: async () => { if (dirty) await saveDraft(true); return api.post<{ receipt: Receipt }>(`/activities/${id}/confirm-final`).then((r) => r.data.receipt); },
    onSuccess: (r) => { setConfirmOpen(false); setReceipt(r); toast.success("Entrega final confirmada!"); qc.invalidateQueries({ queryKey: ["activity", id] }); qc.invalidateQueries({ queryKey: ["activities"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data) {
    return (
      <>
        <PageHeader back={{ to: "/app/atividades", label: "Atividades" }} title="Atividade" />
        <Empty title="Não foi possível abrir esta atividade">{errorMessage(q.error, "Tente novamente.")} <Link className="link" to="/app/equipe">Formar equipe</Link></Empty>
      </>
    );
  }
  const { activity: a, submission, files, removedFiles, versions } = q.data;
  const received = submission && submission.state !== "draft";
  const formats = a.acceptedFormats.length ? a.acceptedFormats.map((f) => f.toUpperCase()).join(", ") : null;
  const allowFiles = a.maxFiles > 0;

  const addLink = () => {
    try { new URL(newLink); } catch { toast.error("Link inválido. Comece com https://"); return; }
    setLinks([...links, { url: newLink }]); setNewLink(""); setDirty(true);
  };

  const tabs = [
    ...(a.allowText ? [{ id: "resposta" as const, label: "Resposta" }] : []),
    ...(allowFiles ? [{ id: "arquivos" as const, label: "Arquivos", count: files.length + uploads.length }] : []),
    ...(a.allowLinks ? [{ id: "links" as const, label: "Links", count: links.length }] : []),
    { id: "historico" as const, label: "Histórico", count: versions.length },
  ];
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
  const idx = tabs.findIndex((t) => t.id === current);

  return (
    <>
      <PageHeader back={{ to: "/app/atividades", label: "Atividades" }} title={a.title} subtitle={a.objective} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={q.data.status} />
        <Badge tone={a.required ? "danger" : "neutral"}>{a.required ? "Obrigatória" : "Opcional"}</Badge>
        {received && (q.data.verified ? <Badge tone="success">Conferida pela organização</Badge> : <Badge tone="warn">Recebida · aguardando conferência</Badge>)}
        <span className="text-sm text-muted">Prazo: {fmtDateTime(a.dueAt)}</span>
      </div>

      {q.data.status === "closed" && <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-danger/25 bg-danger-soft p-4 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> O prazo desta atividade foi encerrado. Se precisar enviar, fale com a organização.</div>}
      {submission?.state === "final_confirmed" && <div className="mb-6 flex items-start gap-3 rounded-lg border border-success/25 bg-success-soft p-4 text-sm text-success"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Entrega final confirmada. Esta é a versão apresentada para avaliação.</div>}

      <section className="card mb-6"><h2 className="eyebrow mb-2">Instruções</h2><p className="text-sm whitespace-pre-line">{a.instructions || "—"}</p></section>

      <Tabs tabs={tabs} value={current} onChange={setTab} />

      <div className="py-6">
        {current === "resposta" && (
          <section aria-labelledby="resp"><SectionTitle title="Resposta da equipe" hint="O texto é salvo automaticamente enquanto você escreve." />
            <Textarea id="resp" aria-label="Resposta da equipe" className="min-h-64" disabled={locked} value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }} placeholder="Escreva aqui." /></section>
        )}

        {current === "links" && (
          <section aria-labelledby="lnk"><SectionTitle title="Links" hint="Confira se o link está com permissão de acesso para qualquer pessoa com o endereço. A organização sinaliza links que não abrem." />
            <ul id="lnk" className="mb-3 space-y-2">{links.map((l, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"><Link2 className="size-4 shrink-0 text-muted" aria-hidden /><a className="min-w-0 flex-1 truncate" href={l.url} target="_blank" rel="noreferrer">{l.url}</a>
                {!locked && <button className="rounded-md p-1 text-muted hover:bg-subtle" aria-label="Remover link" onClick={() => { setLinks(links.filter((_, j) => j !== i)); setDirty(true); }}><X className="size-4" /></button>}</li>
            ))}</ul>
            {!locked && <div className="flex gap-2"><Input aria-label="Novo link" placeholder="https://" value={newLink} onChange={(e) => setNewLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())} /><Button variant="outline" onClick={addLink} disabled={!newLink}><Plus /> Adicionar</Button></div>}</section>
        )}

        {current === "arquivos" && (
          <section aria-labelledby="arq"><SectionTitle title="Arquivos" hint={`${formats ? `Formatos aceitos: ${formats}. ` : "PDF, DOCX, PPTX, JPG, PNG, MP4 ou ZIP. "}Até ${a.maxFiles} arquivo(s).`} />
            {!locked && (
              <div
                className="grid cursor-pointer place-items-center gap-1 rounded-xl border border-dashed border-ink/30 bg-surface px-4 py-8 text-center text-sm transition hover:border-ink hover:bg-subtle"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                onClick={() => fileInput.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
              >
                <span className="grid size-10 place-items-center rounded-full border border-line bg-canvas"><CloudUpload className="size-5" aria-hidden /></span>
                <span><span className="font-medium underline underline-offset-2">Clique para enviar</span> ou arraste e solte</span>
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </div>
            )}
            <ul id="arq" className="mt-4 space-y-2">
              {uploads.map((u) => (
                <li key={u.key} className={`rounded-lg border p-3 text-sm ${u.error ? "border-danger/40 bg-danger-soft" : "border-line bg-surface"}`}>
                  <div className="flex items-center gap-3"><FileText className="size-5 text-muted" aria-hidden /><div className="min-w-0 flex-1"><p className="truncate font-medium">{u.file.name}</p><p className="text-xs text-muted">{fmtSize(u.file.size)}</p></div>
                    {u.error ? <Button size="sm" variant="outline" onClick={() => uploadOne(u)}><RotateCw /> Tentar de novo</Button> : <span className="text-xs text-muted">{Math.round(u.progress)}%</span>}
                    {u.error && <button aria-label="Descartar" className="rounded-md p-1 text-muted hover:bg-subtle" onClick={() => setUploads((p) => p.filter((x) => x.key !== u.key))}><X className="size-4" /></button>}</div>
                  {u.error ? <p role="alert" className="mt-2 text-xs font-medium text-danger">{u.error}</p> : <div className="mt-2"><Progress value={u.progress} /></div>}
                </li>
              ))}
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-sm">
                  <FileText className="size-5 text-terra" aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{f.name}</p><p className="text-xs text-muted">Recebido · {fmtSize(f.sizeBytes)} · {f.uploadedBy} · {fmtDateTime(f.createdAt)}</p></div>
                  <Button size="icon" variant="ghost" aria-label={`Baixar ${f.name}`} onClick={() => download(f.id)}><Download /></Button>
                  {!locked && <Button size="icon" variant="danger" aria-label={`Remover ${f.name}`} onClick={() => removeFile.mutate(f.id)}><Trash2 /></Button>}
                </li>
              ))}
            </ul>
            {removedFiles.length > 0 && <p className="mt-3 text-xs text-muted">{removedFiles.length} arquivo(s) substituído(s)/removido(s) estão preservados no histórico.</p>}
          </section>
        )}

        {current === "historico" && (
          <section aria-labelledby="hist"><SectionTitle title="Histórico de envios" hint="Cada envio gera um comprovante." />
            {versions.length === 0 ? <p className="text-sm text-muted">Nenhum envio ainda.</p> : (
              <ul id="hist" className="divide-y divide-line rounded-xl border border-line bg-surface">{versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span><span className="font-medium">Versão {v.version}</span>{v.kind === "final" && <Badge tone="brand" className="ml-2">Final</Badge>}<span className="block text-xs text-muted">{v.by} · {fmtDateTime(v.createdAt)}</span></span>
                  <Button size="sm" variant="outline" onClick={() => openReceipt(v.version)}><History /> Comprovante</Button></li>
              ))}</ul>
            )}</section>
        )}
      </div>

      {/* barra de ação fixa (estilo "Salvar e sair / Próximo") */}
      {!locked && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-32 flex-1"><p className="text-xs text-muted" aria-live="polite">Etapa {idx + 1} de {tabs.length} · {saving === "saving" ? "Salvando…" : saving === "saved" ? "Rascunho salvo" : saving === "error" ? "Não salvo — cópia guardada neste aparelho" : dirty ? "Alterações não salvas" : "Tudo salvo"}</p>
              <div className="mt-1.5 max-w-48"><Progress value={((idx + 1) / tabs.length) * 100} tone="brand" /></div></div>
            <Button variant="outline" onClick={() => saveDraft()} loading={saving === "saving"}><Save /> Salvar rascunho</Button>
            {a.kind === "final" ? (
              <Button variant="brand" onClick={() => setConfirmOpen(true)}><Send /> Conferir e confirmar entrega final</Button>
            ) : (
              <Button variant="brand" onClick={() => submit.mutate()} loading={submit.isPending}><Send /> Enviar atividade</Button>
            )}
          </div>
        </div>
      )}

      <Modal open={confirmOpen} onOpenChange={setConfirmOpen} title="Conferência da entrega final" description="Confira os itens obrigatórios antes de confirmar.">
        {checklist.isLoading ? <PageLoading /> : (
          <>
            <ul className="space-y-2">{checklist.data?.items.map((it) => (
              <li key={it.label} className="flex items-center gap-2.5 text-sm">{it.ok ? <CheckCircle2 className="size-5 text-success" aria-label="ok" /> : <AlertTriangle className="size-5 text-warn" aria-label="pendente" />}<span className={it.ok ? "" : "font-medium"}>{it.label}</span><span className="ml-auto text-xs text-muted">{it.ok ? "Ok" : "Pendente"}</span></li>
            ))}</ul>
            <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar</Button>
              <Button onClick={() => confirmFinal.mutate()} loading={confirmFinal.isPending} disabled={!checklist.data?.items.every((i) => i.ok)}>Confirmar entrega final</Button></div>
          </>
        )}
      </Modal>

      <Modal open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} title="Comprovante de envio" description={`Código ${receipt?.code ?? ""}`}>
        {receipt && (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Equipe</dt><dd className="font-medium">{receipt.team}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Atividade</dt><dd className="font-medium">{receipt.activity}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Tipo</dt><dd className="font-medium">{receipt.kind === "final" ? "Entrega final" : "Envio da atividade"} · versão {receipt.version}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Recebido em</dt><dd className="font-medium">{new Date(receipt.receivedAt).toLocaleString("pt-BR")}</dd></div>
            <div className="border-t border-line pt-3"><dt className="mb-1 text-muted">Materiais recebidos</dt>
              <dd><ul className="list-disc space-y-1 pl-5">{receipt.materials.text && <li>Resposta em texto</li>}{receipt.materials.links.map((l) => <li key={l.url} className="break-all">{l.url}</li>)}{receipt.materials.files.map((f) => <li key={f.id}>{f.name} ({fmtSize(f.sizeBytes)})</li>)}</ul></dd></div>
            <p className="rounded-xl bg-warn-soft p-3 text-xs text-warn">Recebido pelo sistema não significa conferido: a organização ainda verifica os materiais.</p>
          </dl>
        )}
      </Modal>
    </>
  );
}
