# Plano — Plataforma Hackathon Oficina de Negócios + CLOC

Base: PDF "Hackaton - Descrição da plataforma" + análise pública da Grite (ver `docs/grite-analise.md`).

## 1. Stack

**Back** (`apps/api`): Node 22, Fastify, Zod (fastify-type-provider-zod), Drizzle ORM + PostgreSQL, Supabase Storage (ou Cloudflare R2 via S3 SDK, atrás de uma interface `StorageProvider`), Argon2id para senhas, sessões por cookie httpOnly (tabela `sessions`), Docker + docker-compose (api, postgres, [minio p/ dev]).

**Front** (`apps/web`): React + Vite + TypeScript, Tailwind v4, shadcn/ui, lucide-react, sonner, axios, TanStack Query, React Router, react-hook-form + zod.

**Monorepo**: pnpm workspaces; `packages/shared` com schemas Zod compartilhados (contratos API ↔ front).

## 2. Identidade visual (das referências)

- Fundo cinza muito claro (`#EEF0F3`), superfícies em cards brancos com raio 16–20px e sombra suave.
- Cor primária escura navy (`#1B2A3B`) em botões "Próximo/Enviar"; acento índigo (`#3B3FD8`) em item ativo da sidebar e links; roxo e verde (`#12B886`) para KPIs, sucesso e barras de progresso; vermelho suave em erro ("Tentar novamente").
- Tipografia: Inter (pesos 400/500/600/700), títulos 600, rótulos pequenos em cinza.
- Inputs com borda fina e raio 8px; upload com borda tracejada + ícone de nuvem; stepper "Passo X de Y" no topo dos formulários; badges de status coloridos (pílulas com ponto).
- Layout autenticado: sidebar recolhível + topbar com busca; cards de KPI em gradiente; tabelas limpas com linhas separadas.
- Mobile-first (requisito 15). Logo: marca simples própria do evento (a definir), nunca usar a da Grite.
- Tokens em `@theme` do Tailwind v4; tema shadcn customizado sobre esses tokens.

## 3. Modelo de dados (Drizzle)

`users`, `sessions`, `password_resets`, `events`, `event_participants` (role: student/mentor/organizer/judge), `consents` (privacidade, menor, uso de imagem — separado), `teams`, `team_members`, `team_invites` / `join_requests`, `problems`, `team_problem`, `activities` (prazos, obrigatório, formatos, limites), `submissions` (status: not_started/draft/submitted/feedback/closed + `verified_by_org`), `submission_versions`, `files` (storage key, sha256, size, mime, uploader, status uploaded/complete), `links` (com flag "não abre"), `receipts`, `mentor_assignments`, `mentor_notes`, `help_requests`, `announcements`, `resources`, `rubrics`/`criteria`, `evaluations`, `feedback_releases`, `reopenings` (justificativa + novo prazo), `audit_log`.

Regras-chave: 1 equipe por evento (unique), min/max de membros configuráveis, histórico de versões imutável, notas ocultas até liberação.

## 4. Engenharia reversa — resultado e limites

Ver `docs/grite-analise.md`. Resumo: grite.app.br é um app Bubble.io hoje redirecionando para "domain_not_supported", sem páginas públicas; só o site institucional gritesolucoes.com.br é analisável. Não foi possível extrair fluxos reais. O PDF é a fonte de requisitos.

## 5. Fases

| Fase | Entrega |
|---|---|
| 0 | Monorepo, Docker, CI, lint, tokens visuais, shadcn base |
| 1 | Auth (cadastro, login, recuperação), consentimentos, perfis/permissões no servidor |
| 2 | Página pública + painel do estudante (esqueleto) |
| 3 | Equipes: criar, convite por código/link, solicitar entrada, sem-grupo, regras min/max |
| 4 | Problemas, atribuição/escolha, limites por problema |
| 5 | Atividades + submissões: rascunho/autosave, enviar, entrega final, comprovante, histórico |
| 6 | Upload (URL assinada, progresso, validação de tipo/tamanho, quota por equipe, links) |
| 7 | Mentoria (pedidos de ajuda, orientações) e avisos/materiais |
| 8 | Painel da organização: eventos, prazos, reabertura, acompanhamento, exportações (CSV + ZIP por equipe) |
| 9 | Banca: fichas, notas ponderadas, liberação de devolutiva |
| 10 | Acessibilidade, offline-safe drafts, testes E2E do percurso completo, backups, deploy |

MVP = fases 0–8 (+9 se houver banca), conforme escopo da seção 18 do PDF.

## 6. Pontos em aberto (o PDF deixa configurável)

Datas/mês/local, faixa etária e menores, login Google (opcional), limites de upload/armazenamento, escolha livre vs. atribuição de problemas, pesos da avaliação, prazo de retenção de dados.
