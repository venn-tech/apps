# Plataforma Hackathon Oficina de Negócios + CLOC

Monorepo pnpm: `apps/api` (Fastify + Drizzle + Postgres + Zod + S3), `apps/web` (React + Vite + Tailwind v4 + shadcn-style + TanStack Query), `packages/shared` (schemas Zod compartilhados).
Plano e decisões: [PLAN.md](PLAN.md). Análise pública da Grite: [docs/grite-analise.md](docs/grite-analise.md).

## Rodar em desenvolvimento

```bash
cp .env.example .env
docker compose up -d db minio     # Postgres (porta 5433) e S3 local (9000)
pnpm install
pnpm db:migrate && pnpm db:seed   # cria o evento de exemplo e a conta da organização
pnpm dev:api                      # http://localhost:3334
pnpm dev:web                      # http://localhost:5173 (proxy /api -> 3334)
```

Organização (seed): `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `.env`. Troque a senha antes de qualquer uso real.
Mentores e banca: cadastre-os pela tela de inscrição e promova o perfil em **Organização > Pessoas**; depois atribua equipes em **Equipes**.

## Armazenamento de arquivos

Qualquer serviço S3-compatível, configurado por `S3_*` no `.env`: MinIO (dev), Supabase Storage (endpoint S3 do projeto) ou Cloudflare R2. O upload passa pela API (validação de tipo, tamanho, quota e limite de anexos); downloads usam URL assinada de curta duração com `Content-Disposition: attachment`.

## Produção

`docker compose up -d --build api` sobe a API (aplica migrações ao iniciar). Em produção: HTTPS, `SESSION_COOKIE_SECURE=true`, `WEB_ORIGIN` com o domínio do front, bucket privado, backups do Postgres e SMTP em `SMTP_URL` (sem ele o link de recuperação de senha só é impresso no log).

## O que falta / decisões pendentes

- Datas, local, regulamento, faixa etária e limites reais: configure em **Organização > Evento** (os valores do seed são exemplos).
- Front: servir `apps/web/dist` por Nginx/CDN (ainda sem Dockerfile).
- Testes automatizados e o ensaio do percurso completo (seção 17 do PDF) ainda não foram escritos.
- Login com Google é opcional no PDF e não foi implementado.
- Verificação do conteúdo real do arquivo (magic bytes) e antivírus não implementados; hoje valida extensão + MIME declarado.
