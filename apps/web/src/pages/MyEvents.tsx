import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, MapPin } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { get, setActiveEventId, activateEvent } from "@/lib/api";
import { fmtRange } from "@/lib/utils";

interface Row { id: string; slug: string; name: string; location: string; startsAt: string | null; endsAt: string | null; status: string; team: string | null; role: string }
interface Pub { id: string; slug: string; name: string; startsAt: string | null; endsAt: string | null; registrationOpen: boolean }

/** Eventos de que o aluno já participou (ou participa) e outros eventos abertos. */
export default function MyEvents() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const mine = useQuery({ queryKey: ["my-events"], queryFn: () => get<{ currentId: string | null; events: Row[] }>("/me/events") });
  const all = useQuery({ queryKey: ["pub-events"], queryFn: () => get<{ events: Pub[] }>("/events") });
  if (mine.isLoading) return <PageLoading />;
  const rows = mine.data?.events ?? [];
  const open = (all.data?.events ?? []).filter((e) => e.registrationOpen && !rows.some((r) => r.id === e.id));

  const choose = (id: string) => {
    activateEvent(qc, id);
    nav("/app");
  };

  return (
    <>
      <PageHeader title="Meus eventos" subtitle="Os eventos de que você participa ou já participou. Escolha um para abrir o seu painel." />
      {rows.length === 0 ? <Empty title="Você ainda não participa de nenhum evento">Veja os eventos abertos abaixo e faça sua inscrição.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((e) => (
            <article key={e.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg">{e.name}</h2><p className="mt-0.5 text-xs text-muted">Seu papel: <span className="font-medium text-ink">{e.role === "mentor" ? "Mentor" : "Estudante"}</span></p></div>
                {e.id === mine.data?.currentId ? <Badge tone="success"><Check className="size-3" /> Ativo</Badge> : <Badge>{e.status}</Badge>}</div>
              <div className="mt-3 space-y-1.5 text-sm text-muted">
                <p className="flex items-center gap-2"><CalendarDays className="size-4" aria-hidden />{fmtRange(e.startsAt, e.endsAt)}</p>
                <p className="flex items-center gap-2"><MapPin className="size-4" aria-hidden />{e.location || "A definir"}</p>
                {e.role !== "mentor" && <p>Equipe: <span className="font-medium text-ink">{e.team ?? "ainda sem equipe"}</span></p>}
              </div>
              <div className="mt-auto flex gap-2 pt-4"><Button variant={e.id === mine.data?.currentId ? "outline" : "brand"} size="sm" onClick={() => choose(e.id)}>{e.id === mine.data?.currentId ? "Abrir painel" : "Tornar ativo"}</Button>
                <Button asChild variant="ghost" size="sm"><Link to={`/e/${e.slug}`}>Página do evento</Link></Button></div>
            </article>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <section className="mt-10"><h2 className="mb-3 text-lg">Eventos com inscrições abertas</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {open.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-medium">{e.name}</p><p className="text-sm text-muted">{fmtRange(e.startsAt, e.endsAt)}</p></div>
                <Button asChild variant="brand" size="sm"><Link to={`/e/${e.slug}/inscrever`}>Participar</Link></Button></li>
            ))}
          </ul></section>
      )}
    </>
  );
}
