import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import { useMe } from "@/lib/auth";
import type { Problem, Team } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

interface ProblemsResponse { released: boolean; publishedAt?: string; mode?: "free" | "assigned"; maxTeamsPerProblem?: number | null; problems: Problem[] }

const sections: [keyof Problem, string][] = [
  ["context", "Contexto e descrição"], ["affected", "Pessoas ou grupos afetados"], ["references", "Informações e referências"],
  ["constraints", "Limites e condições da proposta"], ["resources", "Recursos que podem ser utilizados"], ["deliverables", "Entregas esperadas"], ["criteria", "Critérios de avaliação"],
];

export default function Problems() {
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["problems"], queryFn: () => get<ProblemsResponse>("/problems") });
  const team = useQuery({ queryKey: ["team"], queryFn: () => get<{ team: Team | null }>("/teams/mine"), enabled: me?.role === "student" });
  const [sel, setSel] = useState<Problem | null>(null);
  const choose = useMutation({
    mutationFn: (id: string) => api.post("/teams/mine/problem", { problemId: id }),
    onSuccess: () => { toast.success("Problema vinculado à sua equipe."); qc.invalidateQueries({ queryKey: ["team"] }); qc.invalidateQueries({ queryKey: ["problems"] }); setSel(null); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <PageLoading />;
  const d = q.data!;
  if (!d.released) {
    return (
      <>
        <PageHeader title="Problemas" />
        <Empty icon={<Clock className="size-5" />} title="Os problemas ainda não foram divulgados">
          Eles serão apresentados na abertura do evento{d.publishedAt ? `, em ${fmtDateTime(d.publishedAt)}` : ""}.
        </Empty>
      </>
    );
  }
  const myProblem = team.data?.team?.problem?.id;
  const canChoose = me?.role === "student" && d.mode === "free" && !!team.data?.team;

  return (
    <>
      <PageHeader title="Problemas e desafios" subtitle={d.mode === "assigned" ? "Os desafios são atribuídos pela organização." : "Leia com calma e escolha o desafio da sua equipe."} />
      {d.problems.length === 0 ? <Empty title="Nenhum problema publicado" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {d.problems.map((p) => {
            const full = !!d.maxTeamsPerProblem && (p.teamsCount ?? 0) >= d.maxTeamsPerProblem && myProblem !== p.id;
            return (
              <article key={p.id} className="card flex flex-col">
                <div className="mb-2 flex items-start justify-between gap-2"><span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Target className="size-5" aria-hidden /></span>
                  {myProblem === p.id ? <Badge tone="success">Escolhido pela sua equipe</Badge> : full ? <Badge tone="danger">Limite de equipes</Badge> : <Badge>{p.teamsCount ?? 0} equipe(s)</Badge>}</div>
                <h2 className="text-lg">{p.title}</h2>
                {p.question && <p className="mt-2 text-sm font-medium text-brand">{p.question}</p>}
                <p className="mt-2 line-clamp-3 text-sm text-muted">{p.context}</p>
                <div className="mt-auto flex gap-2 pt-4"><Button variant="outline" size="sm" onClick={() => setSel(p)}>Ler o desafio</Button></div>
              </article>
            );
          })}
        </div>
      )}
      <Modal open={!!sel} onOpenChange={(o) => !o && setSel(null)} title={sel?.title ?? ""} description={sel?.question}>
        {sel && (
          <div className="space-y-4">
            {sections.map(([k, label]) => sel[k] ? <div key={k}><h3 className="text-sm">{label}</h3><p className="mt-1 text-sm whitespace-pre-line text-muted">{String(sel[k])}</p></div> : null)}
            {canChoose && (
              <div className="border-t border-line pt-4">
                {myProblem === sel.id ? <p className="flex items-center gap-2 text-sm font-medium text-success"><CheckCircle2 className="size-4" /> Este é o desafio da sua equipe.</p> :
                  <Button onClick={() => choose.mutate(sel.id)} loading={choose.isPending}>Escolher este problema</Button>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
