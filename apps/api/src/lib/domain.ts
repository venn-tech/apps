import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db, schema } from "../db/index.js";
import { HttpError, type SessionUser } from "./auth.js";

export type EventRow = typeof schema.events.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare module "fastify" {
  interface FastifyRequest {
    activeEvent: EventRow | null;
  }
}

export async function isParticipant(userId: string, eventId: string) {
  const [p] = await db.select({ u: schema.eventParticipants.userId }).from(schema.eventParticipants)
    .where(and(eq(schema.eventParticipants.userId, userId), eq(schema.eventParticipants.eventId, eventId))).limit(1);
  return !!p;
}

type EventRole = "student" | "mentor";
const asEventRole = (r: string): EventRole => (r === "mentor" || r === "judge" ? "mentor" : "student");

async function participation(userId: string, eventId: string) {
  const [row] = await db.select({ e: schema.events, role: schema.eventParticipants.role }).from(schema.eventParticipants)
    .innerJoin(schema.events, eq(schema.events.id, schema.eventParticipants.eventId))
    .where(and(eq(schema.eventParticipants.userId, userId), eq(schema.eventParticipants.eventId, eventId))).limit(1);
  return row;
}

/**
 * Define o evento ativo da requisição e o PAPEL da pessoa nele (aluno num evento, mentor em outro).
 * O front envia X-Event-Id (ou ?eventId= nos downloads). Sem um válido: organização = evento mais antigo;
 * demais = evento em que entrou por último. A organização é global.
 */
export async function applyEventContext(req: FastifyRequest) {
  req.activeEvent = null;
  const user = req.user;
  if (!user) return;
  const hdr = req.headers["x-event-id"] ?? (req.query as { eventId?: string } | undefined)?.eventId;
  const wanted = typeof hdr === "string" && UUID.test(hdr) ? hdr : null;

  if (user.role === "organizer") {
    if (wanted) [req.activeEvent] = await db.select().from(schema.events).where(eq(schema.events.id, wanted)).limit(1);
    if (!req.activeEvent) [req.activeEvent] = await db.select().from(schema.events).orderBy(asc(schema.events.createdAt)).limit(1);
    return;
  }

  let hit = wanted ? await participation(user.id, wanted) : undefined;
  if (!hit) {
    const [row] = await db.select({ e: schema.events, role: schema.eventParticipants.role }).from(schema.eventParticipants)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventParticipants.eventId))
      .where(eq(schema.eventParticipants.userId, user.id)).orderBy(desc(schema.eventParticipants.joinedAt)).limit(1);
    hit = row;
  }
  req.activeEvent = hit?.e ?? null;
  req.user = { ...user, role: hit ? asEventRole(hit.role) : "student" };
}

export async function getEvent(req: FastifyRequest): Promise<EventRow> {
  if (!req.user) throw new HttpError(401, "Faça login para continuar", "unauthenticated");
  if (!req.activeEvent) throw new HttpError(404, "Você ainda não participa de nenhum evento", "no_event");
  return req.activeEvent;
}

export async function eventBySlug(slug: string) {
  const [e] = await db.select().from(schema.events).where(eq(schema.events.slug, slug)).limit(1);
  if (!e) throw new HttpError(404, "Evento não encontrado");
  return e;
}

export async function joinEvent(userId: string, eventId: string) {
  await db.insert(schema.eventParticipants).values({ eventId, userId }).onConflictDoNothing();
}

export function slugify(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "evento";
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, data?: unknown) {
  await db.insert(schema.auditLog).values({ actorId, action, entity, entityId, data: data ?? null });
}

/** Equipe da pessoa no evento ativo da requisição. */
export async function myTeamId(userId: string, req: FastifyRequest) {
  const event = await getEvent(req);
  const [row] = await db.select({ teamId: schema.teamMembers.teamId }).from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.userId, userId), eq(schema.teamMembers.eventId, event.id))).limit(1);
  return row?.teamId ?? null;
}

/** Organização: todas. Integrante: a própria equipe. Mentor: equipes dos eventos em que é mentor. */
export async function assertTeamAccess(user: SessionUser, teamId: string) {
  if (user.role === "organizer") return;
  const [team] = await db.select({ eventId: schema.teams.eventId }).from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  if (!team) throw new HttpError(404, "Equipe não encontrada");
  const [m] = await db.select({ u: schema.teamMembers.userId }).from(schema.teamMembers)
    .where(and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, user.id))).limit(1);
  if (m) return;
  const p = await participation(user.id, team.eventId);
  if (p && asEventRole(p.role) === "mentor") return;
  throw new HttpError(403, "Sem acesso a esta equipe");
}

export const effectiveDue = (activityDue: Date, override: Date | null) => override && override > activityDue ? override : activityDue;

export function newInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // evita injeção de fórmula em planilhas
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\n");
}
