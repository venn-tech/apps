import { eq, and, gt, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "@hackaton/shared";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import {
  HttpError, createSession, destroySession, hashPassword, newToken, requireUser, sha256, verifyPassword,
} from "../lib/auth.js";
import { audit, eventBySlug, joinEvent } from "../lib/domain.js";
import { sendMail } from "../lib/mail.js";

const publicUser = (u: typeof schema.users.$inferSelect) => ({
  id: u.id, email: u.email, fullName: u.fullName, displayName: u.displayName, role: u.role,
  school: u.school, ageRange: u.ageRange, accessibilityNeeds: u.accessibilityNeeds,
  imageConsent: !!u.imageConsentAt,
});

export async function authRoutes(app: FastifyInstance) {
  const limited = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/auth/register", limited, async (req, reply) => {
    const input = registerSchema.parse(req.body);
    // com eventSlug: cria a conta e já inscreve no evento; sem: só cria a conta
    const event = input.eventSlug ? await eventBySlug(input.eventSlug) : null;
    if (event && !event.registrationOpen) throw new HttpError(403, "As inscrições deste evento estão encerradas");
    if (input.ageRange === "under_18" && !input.guardianConsent) {
      throw new HttpError(422, "Participantes menores de idade precisam da autorização do responsável");
    }
    const [dup] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
    if (dup) throw new HttpError(409, "Já existe uma conta com este e-mail");
    const now = new Date();
    const [user] = await db.insert(schema.users).values({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      displayName: input.displayName,
      school: input.school || null,
      ageRange: input.ageRange ?? null,
      accessibilityNeeds: input.accessibilityNeeds || null,
      rulesAcceptedAt: now,
      privacyAcceptedAt: now,
      guardianConsentAt: input.guardianConsent ? now : null,
    }).returning();
    if (event) await joinEvent(user.id, event.id);
    await createSession(reply, user.id);
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.post("/auth/login", limited, async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email)).limit(1);
    // mesma mensagem para e-mail inexistente e senha errada
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
      throw new HttpError(401, "E-mail ou senha incorretos");
    }
    await createSession(reply, user.id);
    return { user: publicUser(user) };
  });

  app.post("/auth/logout", async (req, reply) => {
    await destroySession(req, reply);
    return { ok: true };
  });

  app.get("/auth/me", async (req) => ({ user: req.user ? publicUser(req.user) : null }));

  app.patch("/auth/me", async (req) => {
    const user = requireUser(req);
    const input = z.object({
      displayName: z.string().trim().min(1).max(40).optional(),
      school: z.string().trim().max(120).optional(),
      accessibilityNeeds: z.string().trim().max(500).optional(),
      imageConsent: z.boolean().optional(),
    }).parse(req.body);
    const [u] = await db.update(schema.users).set({
      displayName: input.displayName,
      school: input.school,
      accessibilityNeeds: input.accessibilityNeeds,
      ...(input.imageConsent === undefined ? {} : { imageConsentAt: input.imageConsent ? new Date() : null }),
    }).where(eq(schema.users.id, user.id)).returning();
    return { user: publicUser(u) };
  });

  app.post("/auth/forgot", limited, async (req) => {
    const { email } = forgotSchema.parse(req.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (user) {
      const token = newToken();
      await db.insert(schema.passwordResets).values({
        tokenHash: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await sendMail(user.email, "Recuperação de acesso", `Use este link para criar uma nova senha (vale por 1 hora):\n${env.WEB_ORIGIN}/redefinir-senha?token=${token}`);
    }
    // resposta idêntica exista ou não a conta
    return { ok: true };
  });

  app.post("/auth/reset", limited, async (req) => {
    const { token, password } = resetSchema.parse(req.body);
    const [row] = await db.select().from(schema.passwordResets).where(and(
      eq(schema.passwordResets.tokenHash, sha256(token)),
      isNull(schema.passwordResets.usedAt),
      gt(schema.passwordResets.expiresAt, new Date()),
    )).limit(1);
    if (!row) throw new HttpError(400, "Link inválido ou expirado. Solicite um novo.");
    await db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, row.userId));
    await db.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.tokenHash, row.tokenHash));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, row.userId));
    await audit(row.userId, "password.reset", "user", row.userId);
    return { ok: true };
  });
}
