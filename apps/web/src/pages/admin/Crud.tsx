import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { acceptedFormats } from "@hackaton/shared";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import { fmtDateTime, toLocalInput } from "@/lib/utils";

export interface FieldDef { key: string; label: string; type: "text" | "textarea" | "datetime" | "number" | "checkbox" | "formats" | "select"; options?: [string, string][]; hint?: string; required?: boolean }
type Row = Record<string, any> & { id: string };

interface Props {
  title: string; subtitle?: string; path: string; fields: FieldDef[]; defaults: Record<string, unknown>;
  columns: { key: string; label: string; render?: (r: Row) => React.ReactNode }[]; noun: string; fem?: boolean;
}

export default function Crud({ title, subtitle, path, fields, defaults, columns, noun, fem }: Props) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", path], queryFn: () => get<{ items: Row[] }>(`/admin/${path}`) });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const open = (r: Row | "new") => {
    const base = r === "new" ? defaults : r;
    setForm(Object.fromEntries(fields.map((f) => [f.key, f.type === "datetime" ? toLocalInput(base[f.key] as string) : base[f.key] ?? defaults[f.key] ?? (f.type === "checkbox" ? false : f.type === "formats" ? [] : "")])));
    setEditing(r);
  };

  const payload = () => Object.fromEntries(fields.map((f) => {
    const v = form[f.key];
    if (f.type === "datetime") return [f.key, v ? new Date(v).toISOString() : undefined];
    if (f.type === "number") return [f.key, Number(v)];
    return [f.key, v];
  }));

  const save = useMutation({
    mutationFn: () => (editing === "new" ? api.post(`/admin/${path}`, payload()) : api.put(`/admin/${path}/${(editing as Row).id}`, payload())),
    onSuccess: () => { toast.success("Salvo."); setEditing(null); qc.invalidateQueries({ queryKey: ["admin", path] }); qc.invalidateQueries({ queryKey: ["problems"] }); qc.invalidateQueries({ queryKey: ["activities"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/${path}/${id}`),
    onSuccess: () => { toast.success("Removido."); qc.invalidateQueries({ queryKey: ["admin", path] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageLoading />;
  const items = q.data?.items ?? [];

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => open("new")}><Plus /> {fem ? "Nova" : "Novo"} {noun}</Button>} />
      {items.length === 0 ? <Empty title={`${fem ? "Nenhuma" : "Nenhum"} ${noun} cadastrad${fem ? "a" : "o"}`} /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-subtle text-xs text-muted"><tr>{columns.map((c) => <th key={c.key} className="px-5 py-3 font-medium">{c.label}</th>)}<th className="px-5 py-3"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody className="divide-y divide-line">
              {items.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => <td key={c.key} className="px-5 py-3.5">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}
                  <td className="px-5 py-3.5"><div className="flex justify-end gap-1.5">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => open(r)}><Pencil /></Button>
                    <Button size="icon" variant="danger" aria-label="Excluir" onClick={() => confirm(`Excluir este ${noun}?`) && del.mutate(r.id)}><Trash2 /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? `${fem ? "Nova" : "Novo"} ${noun}` : `Editar ${noun}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`f-${f.key}`} hint={f.hint} required={f.required}>
              {f.type === "textarea" ? <Textarea id={`f-${f.key}`} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /> :
                f.type === "checkbox" ? <label className="flex items-center gap-2 text-sm"><input id={`f-${f.key}`} type="checkbox" className="size-5 accent-[var(--ink)]" checked={!!form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} /> Sim</label> :
                f.type === "formats" ? <div className="flex flex-wrap gap-3">{acceptedFormats.map((fm) => <label key={fm} className="flex items-center gap-1.5 text-sm uppercase"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={(form[f.key] ?? []).includes(fm)} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked ? [...(form[f.key] ?? []), fm] : (form[f.key] ?? []).filter((x: string) => x !== fm) })} />{fm}</label>)}</div> :
                f.type === "select" ? <select id={`f-${f.key}`} className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select> :
                <Input id={`f-${f.key}`} type={f.type === "datetime" ? "datetime-local" : f.type === "number" ? "number" : "text"} step={f.type === "number" ? "any" : undefined} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </Field>
          ))}
          <div className="flex justify-end gap-2 border-t border-line pt-4"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
        </form>
      </Modal>
    </>
  );
}

export { fmtDateTime };
