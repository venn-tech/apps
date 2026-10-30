import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { env } from "./env.js";
import { HttpError, loadUser } from "./lib/auth.js";
import { applyEventContext } from "./lib/domain.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { publicRoutes } from "./routes/public.js";
import { staffRoutes } from "./routes/staff.js";
import { teamRoutes } from "./routes/teams.js";
import { workRoutes } from "./routes/work.js";

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(helmet);
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { files: 1, fields: 0 } });

  app.decorateRequest("user", null);
  app.decorateRequest("activeEvent", null);
  app.addHook("onRequest", async (req) => {
    // proteção CSRF: cookies são lax, mas mutações só aceitas da origem do front
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== env.WEB_ORIGIN) throw new HttpError(403, "Origem não permitida");
    }
    await loadUser(req);
    await applyEventContext(req);
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues[0]?.message ?? "Dados inválidos", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    }
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message, code: err.code });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: err.message });
    req.log.error(err);
    return reply.code(500).send({ error: "Erro interno. Tente novamente em instantes." });
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(publicRoutes);
      await api.register(teamRoutes);
      await api.register(workRoutes);
      await api.register(staffRoutes);
      await api.register(adminRoutes);
    },
    { prefix: "/api" },
  );
  return app;
}
