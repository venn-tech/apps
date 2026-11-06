import path from "node:path";
import { z } from "zod";

// Carrega o .env da raiz do monorepo (as variáveis já definidas no ambiente têm prioridade).
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  /* sem .env: usa apenas o ambiente (ex.: Docker) */
}

const bool = z.enum(["true", "false"]).default("false").transform((v) => v === "true");

export const env = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3333),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  SESSION_COOKIE_SECURE: bool,
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_FORCE_PATH_STYLE: bool,
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("venn <nao-responda@venn-hackatons.online>"),
  SEED_ADMIN_EMAIL: z.string().default("organizacao@example.com"),
  SEED_ADMIN_PASSWORD: z.string().default("troque-esta-senha"),
}).parse(process.env);
