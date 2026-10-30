import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@hackaton/shared";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";

export const COOKIE = "sid";
const SESSION_DAYS = 7;

// o enum do banco ainda tem "judge" (legado); a aplicação trata como "mentor"
export type SessionUser = Omit<typeof schema.users.$inferSelect, "role"> & { role: Role };

declare module "fastify" {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export const hashPassword = (p: string) => hash(p);
export const verifyPassword = (h: string, p: string) => verify(h, p);
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export async function createSession(reply: FastifyReply, userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(schema.sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.SESSION_COOKIE_SECURE,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[COOKIE];
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  reply.clearCookie(COOKIE, { path: "/" });
}

export async function loadUser(req: FastifyRequest) {
  req.user = null;
  const token = req.cookies[COOKIE];
  if (!token) return;
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  req.user = row ? { ...row.user, role: row.user.role === "judge" ? "mentor" : row.user.role } : null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new HttpError(401, "Faça login para continuar", "unauthenticated");
  return req.user;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): SessionUser {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw new HttpError(403, "Sem permissão para esta ação", "forbidden");
  return user;
}
