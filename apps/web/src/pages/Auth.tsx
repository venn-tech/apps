import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { registerSchema } from "@hackaton/shared";
import { Logo, LogoMark } from "@/components/Logo";
import { PolyBackground } from "@/components/PolyBackground";
import { ThemeToggle } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { api, errorMessage, get, setActiveEventId, activateEvent } from "@/lib/api";
import { homeFor, useMe, type Me } from "@/lib/auth";

function AuthFrame({ title, subtitle, step, children, footer }: { title: string; subtitle?: string; step?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const n = step ? Number(step.match(/\d+/)?.[0] ?? 1) : 0;
  const total = step ? Number(step.match(/de (\d+)/)?.[1] ?? 1) : 0;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col bg-canvas px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between"><Link to="/" className="no-underline" aria-label="Início"><Logo /></Link><ThemeToggle /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {step && <div className="mb-6"><div className="mb-2 flex justify-between text-xs text-muted"><span>{step}</span></div><div className="h-1 overflow-hidden rounded-full bg-subtle"><div className="h-full bg-accent transition-all" style={{ width: `${(n / total) * 100}%` }} /></div></div>}
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-sm text-muted">{footer}</p>}
        </div>
      </div>
      <aside className="dark relative hidden overflow-hidden bg-canvas text-ink lg:block" aria-hidden>
        <PolyBackground />
        <div className="absolute bottom-12 left-10 max-w-sm">
          <LogoMark className="mb-6 size-12" />
          <p className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.04em]">Um desafio. <span className="gradient-text">Ideias em ação.</span></p>
          <p className="mt-3 font-mono text-xs tracking-[0.1em] text-muted uppercase">venn · plataforma de hackathons</p>
        </div>
      </aside>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const loc = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const m = useMutation({
    mutationFn: async () => {
      await api.post("/auth/login", form);
      // o papel depende do evento ativo, então lemos a sessão completa
      return (await qc.fetchQuery({ queryKey: ["me"], queryFn: () => get<{ user: Me | null }>("/auth/me"), staleTime: 0 })).user!;
    },
    onSuccess: (user) => {
      nav((loc.state as { from?: string } | null)?.from ?? homeFor(user.role), { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AuthFrame title="Entrar" subtitle="Acesse com o e-mail e a senha do seu cadastro." footer={<>Ainda não tem conta? <Link to="/cadastro" className="link">Criar conta</Link></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="E-mail" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Senha" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="flex items-center justify-between">
          <Link to="/esqueci-senha" className="link text-sm">Esqueci minha senha</Link>
          <Button type="submit" variant="brand" loading={m.isPending}>Entrar</Button>
        </div>
      </form>
    </AuthFrame>
  );
}

const useEventBySlug = (slug?: string) => useQuery({ queryKey: ["pub-event", slug], queryFn: () => get<{ event: { id: string; name: string; slug: string } }>(`/events/${slug}`), enabled: !!slug, retry: false });

/** Inscrição em um evento: logada = só associa ao evento; sem conta = cria a conta e já inscreve. */
export function RegisterRoute() {
  const { slug } = useParams();
  const { me, loading } = useMe();
  if (loading) return null;
  return me && slug ? <JoinEvent slug={slug} /> : <Register />;
}

function JoinEvent({ slug }: { slug: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { me } = useMe();
  const ev = useEventBySlug(slug);
  const join = useMutation({
    mutationFn: () => api.post<{ event: { id: string } }>(`/events/${slug}/join`).then((r) => r.data.event),
    onSuccess: (e) => {
      activateEvent(qc, e.id);
      toast.success("Inscrição confirmada!");
      nav("/app/equipe", { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AuthFrame title="Participar do evento" subtitle={ev.data ? `Você já tem conta. Confirme para se inscrever no ${ev.data.event.name}.` : "Carregando evento…"}
      footer={<Link to="/app" className="link">Ir para a minha área</Link>}>
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-surface p-4 text-sm"><p className="font-medium">{me?.fullName}</p><p className="text-muted">{me?.email}</p></div>
        {me && me.role !== "student"
          ? <p className="rounded-lg border border-warn/25 bg-warn-soft p-3 text-sm text-warn">Mentores e organização são adicionados ao evento pela organização.</p>
          : <Button variant="brand" size="lg" className="w-full" loading={join.isPending} disabled={!ev.data} onClick={() => join.mutate()}>Confirmar participação</Button>}
      </div>
    </AuthFrame>
  );
}

export function Register() {
  const { slug } = useParams();
  const ev = useEventBySlug(slug);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({
    fullName: "", displayName: "", email: "", password: "", school: "", ageRange: "" as "" | "under_18" | "18_plus",
    accessibilityNeeds: "", guardianConsent: false, acceptRules: false, acceptPrivacy: false,
  });
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const m = useMutation({
    mutationFn: () => api.post<{ user: Me }>("/auth/register", { ...f, ageRange: f.ageRange || undefined, eventSlug: slug }).then((r) => r.data.user),
    onSuccess: async (user) => {
      qc.setQueryData(["me"], { user });
      if (ev.data) setActiveEventId(ev.data.event.id);
      qc.invalidateQueries({ queryKey: ["my-events"] });
      toast.success(slug ? "Conta criada e inscrição confirmada! Agora forme sua equipe." : "Conta criada!");
      nav(slug ? "/app/equipe" : "/app", { replace: true });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const validate = (fields: string[]) => {
    const r = registerSchema.safeParse({ ...f, ageRange: f.ageRange || undefined });
    const errs: Record<string, string> = {};
    if (!r.success) for (const i of r.error.issues) { const k = String(i.path[0]); if (fields.includes(k) && !errs[k]) errs[k] = i.message; }
    if (fields.includes("guardianConsent") && f.ageRange === "under_18" && !f.guardianConsent) errs.guardianConsent = "É preciso a autorização do responsável";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <AuthFrame title={step === 1 ? "Seus dados" : "Participação"} step={`Passo ${step} de 2`} subtitle={ev.data ? `Inscrição no ${ev.data.event.name}. ${step === 1 ? "Pedimos só o necessário." : "Confira as autorizações e finalize."}` : step === 1 ? "Pedimos só o necessário para participar." : "Quase lá! Confira as autorizações e finalize."} footer={<>Já tem conta? <Link to="/entrar" state={slug ? { from: `/e/${slug}/inscrever` } : undefined} className="link">Entrar{slug ? " e se inscrever" : ""}</Link></>}>
      {step === 1 ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (validate(["fullName", "displayName", "email", "password"])) setStep(2); }}>
          <Field label="Nome completo" required htmlFor="fullName" error={errors.fullName}><Input id="fullName" autoComplete="name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
          <Field label="Como quer ser chamado(a)" required htmlFor="displayName" error={errors.displayName}><Input id="displayName" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} /></Field>
          <Field label="E-mail" required htmlFor="email" error={errors.email}><Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Senha" required htmlFor="password" hint="Mínimo de 8 caracteres." error={errors.password}><Input id="password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} /></Field>
          <div className="flex justify-end border-t border-line pt-4"><Button type="submit">Próximo</Button></div>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (validate(["acceptRules", "acceptPrivacy", "guardianConsent"])) m.mutate(); }}>
          <Field label="Escola, turma ou vínculo com a formação" htmlFor="school"><Input id="school" value={f.school} onChange={(e) => set("school", e.target.value)} /></Field>
          <Field label="Faixa etária" htmlFor="age"><Select id="age" value={f.ageRange} onChange={(e) => set("ageRange", e.target.value)}><option value="">Prefiro não informar</option><option value="under_18">Menor de 18 anos</option><option value="18_plus">18 anos ou mais</option></Select></Field>
          {f.ageRange === "under_18" && (
            <label className="flex items-start gap-3 rounded-xl bg-warn-soft p-3 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={f.guardianConsent} onChange={(e) => set("guardianConsent", e.target.checked)} />
              <span>Tenho a autorização do meu responsável para participar do evento.{errors.guardianConsent && <span role="alert" className="block font-medium text-danger">{errors.guardianConsent}</span>}</span>
            </label>
          )}
          <Field label="Precisa de acessibilidade ou apoio? (opcional)" htmlFor="acc" hint="Só a organização vê esta informação."><Textarea id="acc" className="min-h-20" value={f.accessibilityNeeds} onChange={(e) => set("accessibilityNeeds", e.target.value)} /></Field>
          <div className="space-y-2.5 border-t border-line pt-4">
            {([["acceptRules", "Li e aceito as regras de participação."], ["acceptPrivacy", "Estou ciente do aviso de privacidade."]] as const).map(([k, label]) => (
              <label key={k} className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
                <span>{label} <span className="text-danger" aria-hidden>*</span>{errors[k] && <span role="alert" className="block text-xs font-medium text-danger">{errors[k]}</span>}</span>
              </label>
            ))}
            <p className="text-xs text-muted">A autorização para uso público de imagem ou vídeo é pedida separadamente, depois, no seu perfil.</p>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4">
            <button type="button" className="link text-sm" onClick={() => setStep(1)}>Voltar</button>
            <Button type="submit" loading={m.isPending}>Criar conta</Button>
          </div>
        </form>
      )}
    </AuthFrame>
  );
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const m = useMutation({ mutationFn: () => api.post("/auth/forgot", { email }), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <AuthFrame title="Recuperar acesso" footer={<Link to="/entrar" className="link">Voltar para entrar</Link>}>
      {m.isSuccess ? (
        <p className="text-sm">Se existir uma conta com <strong>{email}</strong>, enviamos um link para criar uma nova senha. Ele vale por 1 hora. Não chegou? Procure o apoio da organização.</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <Field label="E-mail do cadastro" htmlFor="email"><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <div className="flex justify-end"><Button type="submit" loading={m.isPending}>Enviar link</Button></div>
        </form>
      )}
    </AuthFrame>
  );
}

export function Reset() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () => api.post("/auth/reset", { token: sp.get("token") ?? "", password }),
    onSuccess: () => { toast.success("Senha alterada. Entre com a nova senha."); nav("/entrar"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AuthFrame title="Nova senha">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="Nova senha" htmlFor="pw" hint="Mínimo de 8 caracteres."><Input id="pw" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="flex justify-end"><Button type="submit" loading={m.isPending}>Salvar senha</Button></div>
      </form>
    </AuthFrame>
  );
}
