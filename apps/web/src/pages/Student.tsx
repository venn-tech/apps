import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Empty, PageHeader, PageLoading } from "@/components/ui/misc";
import { get } from "@/lib/api";
import type { Announcement, ResourceItem } from "@/lib/types";
import { fmtDateTime } from "@/lib/utils";

export function NoticesPage() {
  const news = useQuery({ queryKey: ["announcements"], queryFn: () => get<{ announcements: Announcement[] }>("/announcements") });
  const res = useQuery({ queryKey: ["resources"], queryFn: () => get<{ resources: ResourceItem[] }>("/resources") });
  if (news.isLoading) return <PageLoading />;
  return (
    <>
      <PageHeader title="Avisos e materiais de apoio" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card" aria-labelledby="av">
          <h2 id="av" className="mb-4 text-lg">Avisos</h2>
          {(news.data?.announcements.length ?? 0) === 0 ? <Empty title="Nenhum aviso por enquanto" /> : (
            <ul className="divide-y divide-line">{news.data!.announcements.map((n) => <li key={n.id} className="py-3 first:pt-0"><p className="font-semibold">{n.title}</p><p className="text-sm whitespace-pre-line text-muted">{n.body}</p><p className="mt-1 text-xs text-muted">{fmtDateTime(n.createdAt)}</p></li>)}</ul>
          )}
        </section>
        <section className="card" aria-labelledby="mat">
          <h2 id="mat" className="mb-4 text-lg">Materiais de apoio</h2>
          {(res.data?.resources.length ?? 0) === 0 ? <Empty title="Sem materiais publicados" /> : (
            <ul className="space-y-2">{res.data!.resources.map((r) => (
              <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-xl border border-line p-3 text-ink no-underline hover:bg-subtle"><ExternalLink className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /><span><span className="block text-sm font-medium">{r.title}</span><span className="block text-xs text-muted">{r.description}</span></span></a></li>
            ))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
