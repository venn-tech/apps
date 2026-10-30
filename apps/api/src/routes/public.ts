import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db/index.js";
import { HttpError, requireRole, requireUser } from "../lib/auth.js";
import { audit, eventBySlug, getEvent, joinEvent } from "../lib/domain.js";

type EventRow = typeof schema.events.$inferSelect;

// Payload público: os problemas não são antecipados.
const publicEvent = (e: EventRow) => ({
  id: e.id, slug: e.slug, name: e.name, description: e.description, location: e.location,
  startsAt: e.startsAt, endsAt: e.endsAt, registrationOpen: e.registrationOpen,
  minTeamSize: e.minTeamSize, maxTeamSize: e.maxTeamSize, allowMixedClasses: e.allowMixedClasses,
  problemsPublishedAt: e.problemsPublishedAt, schedule: e.schedule, faq: e.faq, rulesUrl: e.rulesUrl, maxFileMb: e.maxFileMb,
});

export async function publicRoutes(app: FastifyInstance) {
  // ---- páginas públicas (cada evento tem a sua URL: /e/:slug) ----
  app.get("/events", async () => {
    const rows = await db.select().from(schema.events).orderBy(desc(schema.events.startsAt), desc(schema.events.createdAt));
    return { events: rows.map((e) => ({ id: e.id, slug: e.slug, name: e.name, description: e.description, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt, registrationOpen: e.registrationOpen })) };
  });

  app.get("/events/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    return { event: publicEvent(await eventBySlug(slug)) };
  });

  // Inscrição de quem já tem conta: só associa a pessoa ao evento.
  app.post("/events/:slug/join", async (req) => {
    const user = requireUser(req);
    const { slug } = req.params as { slug: string };
    const e = await eventBySlug(slug);
    if (user.role === "organizer") throw new HttpError(403, "A organização gerencia os eventos pelo painel.");
    const [already] = await db.select({ u: schema.eventParticipants.userId }).from(schema.eventParticipants)
      .where(and(eq(schema.eventParticipants.eventId, e.id), eq(schema.eventParticipants.userId, user.id))).limit(1);
    if (!already) {
      if (!e.registrationOpen) throw new HttpError(403, "As inscrições deste evento estão encerradas");
      await joinEvent(user.id, e.id);
      await audit(user.id, "event.join", "event", e.id);
    }
    return { joined: true, alreadyJoined: !!already, event: { id: e.id, slug: e.slug, name: e.name } };
  });

  // ---- evento ativo do usuário logado ----
  app.get("/event", async (req) => {
    const e = await getEvent(req);
    return { event: publicEvent(e) };
  });

  // Eventos de que a pessoa participa (organização vê todos).
  app.get("/me/events", async (req) => {
    const user = requireUser(req);
    const current = await getEvent(req).catch(() => null);
    const rows = user.role === "organizer"
      ? await db.select({ e: schema.events, joinedAt: sql<Date | null>`null`, role: sql<string>`'organizer'` }).from(schema.events).orderBy(desc(schema.events.createdAt))
      : await db.select({ e: schema.events, joinedAt: schema.eventParticipants.joinedAt, role: schema.eventParticipants.role }).from(schema.eventParticipants)
          .innerJoin(schema.events, eq(schema.events.id, schema.eventParticipants.eventId))
          .where(eq(schema.eventParticipants.userId, user.id)).orderBy(desc(schema.eventParticipants.joinedAt));
    const teams = await db.select({ eventId: schema.teamMembers.eventId, name: schema.teams.name }).from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId)).where(eq(schema.teamMembers.userId, user.id));
    const now = Date.now();
    return {
      currentId: current?.id ?? null,
      events: rows.map(({ e, joinedAt, role }) => ({
        id: e.id, slug: e.slug, name: e.name, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt,
        status: !e.startsAt && !e.endsAt ? "datas a definir" : e.endsAt && new Date(e.endsAt).getTime() < now ? "encerrado" : e.startsAt && new Date(e.startsAt).getTime() > now ? "em breve" : "em andamento",
        joinedAt, role: role === "judge" ? "mentor" : role, team: teams.find((t) => t.eventId === e.id)?.name ?? null,
      })),
    };
  });

  app.get("/announcements", async (req) => {
    requireRole(req, "student", "mentor", "organizer");
    const e = await getEvent(req);
    const rows = await db.select().from(schema.announcements).where(eq(schema.announcements.eventId, e.id)).orderBy(desc(schema.announcements.createdAt)).limit(50);
    return { announcements: rows };
  });

  app.get("/resources", async (req) => {
    requireRole(req, "student", "mentor", "organizer");
    const e = await getEvent(req);
    return { resources: await db.select().from(schema.resources).where(eq(schema.resources.eventId, e.id)).orderBy(asc(schema.resources.title)) };
  });

}
