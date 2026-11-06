import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, ExternalLink, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageLoading, SectionTitle } from "@/components/ui/misc";
import { api, errorMessage, get } from "@/lib/api";
import { qrDataUrl, renderTicketPng, ticketCode, type TicketData } from "@/lib/ticket";
import type { Team } from "@/lib/types";
import { fmtHours, fmtRange } from "@/lib/utils";
import { LogoMark } from "@/components/Logo";

interface Me { id: string; fullName: string; displayName: string; email: string; school: string | null; role: string; imageConsent: boolean }
interface Ev { name: string; startsAt: string | null; endsAt: string | null; location: string }
const roleLabel: Record<string, string> = { student: "Estudante", mentor: "Mentor", judge: "Banca", organizer: "Organização" };

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="eyebrow !text-[10px]">{label}</dt><dd className="mt-1 text-sm font-semibold break-words text-[#0c0b2b]">{value}</dd></div>;
}

export function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me-full"], queryFn: () => get<{ user: Me | null }>("/auth/me") });
  const ev = useQuery({ queryKey: ["event"], queryFn: () => get<{ event: Ev }>("/event") });
  const team = useQuery({ queryKey: ["team"], queryFn: () => get<{ team: Team | null }>("/teams/mine"), enabled: me.data?.user?.role === "student" });
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const u = me.data?.user;
  const e = ev.data?.event;

  const data: TicketData | null = useMemo(() => {
    if (!u || !e) return null;
    return {
      event: e.name,
      date: fmtRange(e.startsAt, e.endsAt),
      time: fmtHours(e.startsAt, e.endsAt),
      place: e.location || "A definir",
      name: u.fullName,
      team: team.data?.team?.name ?? "Sem equipe",
      role: roleLabel[u.role] ?? u.role,
      code: ticketCode(u.id),
      url: location.origin + "/",
    };
  }, [u, e, team.data]);

  useEffect(() => { if (data) qrDataUrl(`${data.url}?ticket=${data.code}`).then(setQr).catch(() => setQr("")); }, [data?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useMutation({
    mutationFn: (imageConsent: boolean) => api.patch("/auth/me", { imageConsent }),
    onSuccess: () => { toast.success("Preferência salva."); qc.invalidateQueries({ queryKey: ["me-full"] }); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!u || !data) return <PageLoading />;
  const text = `Estou participando do ${data.event}! Vem comigo: ${data.url}`;

  const png = async () => { setBusy(true); try { return await renderTicketPng(data); } finally { setBusy(false); } };
  const download = async () => {
    const blob = await png();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `ticket-${data.code}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const share = async () => {
    try {
      const blob = await png();
      const file = new File([blob], `ticket-${data.code}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: data.event });
      else if (navigator.share) await navigator.share({ text, url: data.url, title: data.event });
      else { await download(); toast.info("Imagem baixada. Escolha uma rede abaixo para postar."); }
    } catch (err) { if ((err as Error).name !== "AbortError") toast.error("Não foi possível compartilhar."); }
  };
  const enc = encodeURIComponent;
  const links = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${enc(text)}` },
    { label: "LinkedIn", icon: ExternalLink, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(data.url)}` },
    { label: "X", icon: ExternalLink, href: `https://twitter.com/intent/tweet?text=${enc(`Estou participando do ${data.event}!`)}&url=${enc(data.url)}` },
  ];

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados, seu ticket de participação e as preferências de privacidade." />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {/* cabeçalho de perfil (estilo Stratis) */}
          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="h-28 bg-gradient-to-r from-periwinkle via-accent to-pink" aria-hidden />
            <div className="px-6 pb-6">
              <div className="-mt-12 flex items-end justify-between gap-3">
                <span className="grid size-24 place-items-center rounded-full border-4 border-surface bg-brand-soft font-display text-3xl font-extrabold text-brand">{u.displayName.slice(0, 1).toUpperCase()}</span>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={share} loading={busy}><Share2 /> Compartilhar ticket</Button></div>
              </div>
              <h2 className="mt-4 text-2xl">{u.fullName}</h2>
              <p className="mt-0.5 text-sm text-muted">{u.email}</p>
              <div className="mt-4 flex flex-wrap gap-2"><Badge tone="brand">{roleLabel[u.role] ?? u.role}</Badge>{u.school && <Badge>{u.school}</Badge>}{team.data?.team && <Badge tone="success">Equipe {team.data.team.name}</Badge>}</div>
            </div>
          </section>

          <section className="card"><SectionTitle title="Dados da conta" />
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="eyebrow !text-[10px]">Nome completo</dt><dd className="mt-1 font-medium">{u.fullName}</dd></div>
              <div><dt className="eyebrow !text-[10px]">Como prefere ser chamado</dt><dd className="mt-1 font-medium">{u.displayName}</dd></div>
              <div><dt className="eyebrow !text-[10px]">E-mail</dt><dd className="mt-1 font-medium">{u.email}</dd></div>
              <div><dt className="eyebrow !text-[10px]">Escola / turma</dt><dd className="mt-1 font-medium">{u.school || "—"}</dd></div>
            </dl></section>

          <section className="card"><SectionTitle title="Uso público de imagem e vídeo" hint="Esta autorização é separada da sua participação e do envio dos trabalhos. Você pode mudar quando quiser." />
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-5 accent-[var(--accent)]" checked={u.imageConsent} onChange={(ev) => toggle.mutate(ev.target.checked)} /> Autorizo o uso público de imagem/vídeo meus e do trabalho da minha equipe.</label></section>
        </div>

        {/* ticket */}
        <div>
          <div className="relative mx-auto max-w-sm">
            <div className="overflow-hidden rounded-3xl bg-[#f6f7fc] shadow-2xl ring-1 ring-black/10">
              <div className="bg-gradient-to-br from-periwinkle to-accent p-6 text-white">
                <div className="flex items-center justify-between"><p className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-80">E-ticket · Hackathon</p><LogoMark className="size-7 text-white" /></div>
                <h3 className="mt-3 font-display text-2xl leading-tight font-extrabold tracking-[-0.03em] !text-white">{data.event}</h3>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 p-6">
                <Detail label="Participante" value={data.name} /><Detail label="Equipe" value={data.team} />
                <Detail label="Data" value={data.date} /><Detail label="Horário" value={data.time} />
                <div className="col-span-2"><Detail label="Local" value={data.place} /></div>
              </dl>
              <div className="relative border-t-2 border-dashed border-[#c9cce0]"><span className="absolute -top-3.5 -left-3.5 size-7 rounded-full bg-canvas" aria-hidden /><span className="absolute -top-3.5 -right-3.5 size-7 rounded-full bg-canvas" aria-hidden /></div>
              <div className="flex items-center gap-4 p-6">
                {qr ? <img src={qr} alt={`QR code do ticket ${data.code}`} className="size-24 rounded-lg" /> : <div className="size-24 rounded-lg bg-white" />}
                <div><p className="eyebrow !text-[10px]">Código</p><p className="mt-1 font-mono text-xl font-semibold text-[#0c0b2b]">{data.code}</p><Badge tone="success" className="mt-2"><Check className="size-3" /> Inscrição confirmada</Badge></div>
              </div>
            </div>

            <Button className="mt-4 w-full" variant="primary" size="lg" onClick={download} loading={busy}><Download /> Baixar ticket (PNG)</Button>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {links.map((l) => <Button key={l.label} asChild variant="outline" size="sm"><a href={l.href} target="_blank" rel="noreferrer"><l.icon /> {l.label}</a></Button>)}
            </div>
            <Button className="mt-2 w-full" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(data.url); toast.success("Link copiado"); }}><Copy /> Copiar link do evento</Button>
            <p className="mt-3 text-center text-xs text-muted">Dica: baixe a imagem e poste nos stories ou no feed com o link do evento.</p>
          </div>
        </div>
      </div>
    </>
  );
}
