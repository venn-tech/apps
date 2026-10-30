import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Usa o mesmo .env da raiz do monorepo (drizzle-kit não o carrega sozinho).
try {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"));
} catch {
  /* sem .env: usa apenas o ambiente */
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
