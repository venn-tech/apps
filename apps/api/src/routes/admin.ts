import { ZipArchive } from "archiver";
import { and, asc, count, desc, eq, inArray, ne, notInArray } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  activitySchema, announcementSchema, criterionSchema, eventCreateSchema, eventMemberSchema, eventRoleSchema, eventUpdateSchema, moveMemberSchema,
  problemSchema, reopenSchema, resourceSchema,
} from "@hackaton/shared";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { HttpError, requireRole } from "../lib/auth.js";
import { audit, csv, getEvent, joinEvent, slugify } from "../lib/domain.js";
import { deleteObject, getObjectStream } from "../lib/storage.js";

const idParam = z.object({ id: z.string().uuid() });

async function uniqueSlug(base: string, exceptId?: string) {
  let slug = base, n = 2;
  for (;;) {
    const [hit] = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.slug, slug)).limit(1);
    if (!hit || hit.id === exceptId) return slug;
    slug = `${base}-${n++}`;
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => {
    requireRole(req, "organizer");
  });

  // ---- eventos ----
  app.get("/admin/events", async () => {
    const events = await db.select().from(schema.events).orderBy(desc(schema.events.createdAt));
    const parts = await db.select({ eventId: schema.eventParticipants.eventId, role: schema.eventParticipants.role, n: count() })
      .from(schema.eventParticipants).groupBy(schema.eventParticipants.eventId, schema.eventParticipants.role);
    const teams = await db.select({ eventId: schema.teams.eventId, n: count() }).from(schema.teams).groupBy(schema.teams.eventId);
    return {
      events: events.map((e) => ({
        id: e.id, slug: e.slug, name: e.name, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt, registrationOpen: e.registrationOpen,
        students: parts.find((p) => p.eventId === e.id && p.role === "student")?.n ?? 0,
        mentors: parts.filter((p) => p.eventId === e.id && (p.role === "mentor" || p.role === "judge")).reduce((a, p) => a + p.n, 0),
        teams: teams.find((t) => t.eventId === e.id)?.n ?? 0,
      })),
    };
  });

  app.post("/admin/events", async (req, reply) => {
    const actor = requireRole(req, "organizer");
    const input = eventCreateSchema.parse(req.body);
    const slug = await uniqueSlug(input.slug ?? slugify(input.name));
    const [e] = await db.insert(schema.events).values({
      slug, name: input.name, description: input.description, location: input.location, startsAt: input.startsAt, endsAt: input.endsAt,
    }).returning();
    await audit(actor.id, "event.create", "event", e.id, { slug });
    return reply.code(201).send({ event: e });
  });

  app.get("/admin/event", async (req) => ({ event: await getEvent(req) }));

  app.patch("/admin/event", async (req) => {
    const actor = requireRole(req, "organizer");
    const input = eventUpdateSchema.parse(req.body);
    const e = await getEvent(req);
    if (input.slug && input.slug !== e.slug) {
      const taken = await uniqueSlug(input.slug, e.id);
      if (taken !== input.slug) throw new HttpError(409, "Já existe um evento com esta URL");
    }
    const [u] = await db.update(schema.events).set(input).where(eq(schema.events.id, e.id)).returning();
    await audit(actor.id, "event.update", "event", e.id, input);
    return { event: u };
  });

  // exclui o evento e tudo que depende dele (equipes, entregas, avaliações...); remove também os arquivos enviados
  app.delete("/admin/event", async (req) => {
    const actor = requireRole(req, "organizer");
    const { confirm } = z.object({ confirm: z.string() }).parse(req.body);
    const e = await getEvent(req);
    if (confirm.trim() !== e.name) throw new HttpError(422, "Digite o nome do evento exatamente para confirmar a exclusão");
    const files = await db.select({ key: schema.files.storageKey }).from(schema.files)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.files.teamId)).where(eq(schema.teams.eventId, e.id));
    await db.delete(schema.events).where(eq(schema.events.id, e.id));
    await audit(actor.id, "event.delete", "event", e.id, { name: e.name, slug: e.slug, files: files.length });
    // melhor esforço: o evento já foi excluído mesmo se algum arquivo falhar
    await Promise.allSettled(files.map((f) => deleteObject(f.key)));
    return { ok: true };
  });

  app.get("/admin/overview", async (req) => {
    const e = await getEvent(req);
    const studentsInEvent = db.select({ u: schema.eventParticipants.userId }).from(schema.eventParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.eventParticipants.userId))
      .where(and(eq(schema.eventParticipants.eventId, e.id), eq(schema.eventParticipants.role, "student")));
    const [students] = await db.select({ n: count() }).from(schema.eventParticipants).innerJoin(schema.users, eq(schema.users.id, schema.eventParticipants.userId))
      .where(and(eq(schema.eventParticipants.eventId, e.id), eq(schema.eventParticipants.role, "student")));
    const [teams] = await db.select({ n: count() }).from(schema.teams).where(eq(schema.teams.eventId, e.id));
    const inTeam = db.select({ u: schema.teamMembers.userId }).from(schema.teamMembers).where(eq(schema.teamMembers.eventId, e.id));
    const [free] = await db.select({ n: count() }).from(schema.users).where(and(inArray(schema.users.id, studentsInEvent), notInArray(schema.users.id, inTeam)));
    const [finals] = await db.select({ n: count() }).from(schema.submissions).innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
      .where(and(eq(schema.teams.eventId, e.id), eq(schema.submissions.state, "final_confirmed")));
    return { event: { name: e.name, slug: e.slug }, students: students.n, teams: teams.n, withoutTeam: free.n, finalDeliveries: finals.n };
  });

  // ---- pessoas por evento ----
  app.get("/admin/events/:id/members", async (req) => {
    const { id } = idParam.parse(req.params);
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
    if (!event) throw new HttpError(404, "Evento não encontrado");
    const rows = await db.select({
      id: schema.users.id, email: schema.users.email, fullName: schema.users.fullName, displayName: schema.users.displayName, role: schema.eventParticipants.role,
      school: schema.users.school, ageRange: schema.users.ageRange, accessibilityNeeds: schema.users.accessibilityNeeds,
      joinedAt: schema.eventParticipants.joinedAt, teamName: schema.teams.name,
    }).from(schema.eventParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.eventParticipants.userId))
      .leftJoin(schema.teamMembers, and(eq(schema.teamMembers.userId, schema.users.id), eq(schema.teamMembers.eventId, id)))
      .leftJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
      .where(and(eq(schema.eventParticipants.eventId, id), ne(schema.users.role, "organizer"))).orderBy(asc(schema.users.fullName));
    return { event: { id: event.id, name: event.name, slug: event.slug }, members: rows };
  });

  // adiciona ao evento alguém que já tem conta (mentores, organização ou estudantes)
  app.post("/admin/events/:id/members", async (req, reply) => {
    const actor = requireRole(req, "organizer");
    const { id } = idParam.parse(req.params);
    const { email, role } = eventMemberSchema.parse(req.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (!user) throw new HttpError(404, "Nenhuma conta com este e-mail. A pessoa precisa se cadastrar primeiro.");
    if (user.role === "organizer") throw new HttpError(422, "Esta conta é de organização e já enxerga todos os eventos.");
    await db.insert(schema.eventParticipants).values({ eventId: id, userId: user.id, role }).onConflictDoUpdate({
      target: [schema.eventParticipants.eventId, schema.eventParticipants.userId], set: { role },
    });
    await audit(actor.id, "event.member.add", "event", id, { userId: user.id, role });
    return reply.code(201).send({ ok: true });
  });

  app.delete("/admin/events/:id/members/:userId", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id, userId } = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).parse(req.params);
    await db.transaction(async (tx) => {
      await tx.delete(schema.teamMembers).where(and(eq(schema.teamMembers.eventId, id), eq(schema.teamMembers.userId, userId)));
      await tx.delete(schema.eventParticipants).where(and(eq(schema.eventParticipants.eventId, id), eq(schema.eventParticipants.userId, userId)));
    });
    await audit(actor.id, "event.member.remove", "event", id, { userId });
    return { ok: true };
  });

  // papel da pessoa NESTE evento (aluna aqui, mentora em outro)
  app.patch("/admin/events/:id/members/:userId/role", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id, userId } = z.object({ id: z.string().uuid(), userId: z.string().uuid() }).parse(req.params);
    const { role } = eventRoleSchema.parse(req.body);
    const done = await db.update(schema.eventParticipants).set({ role }).where(and(eq(schema.eventParticipants.eventId, id), eq(schema.eventParticipants.userId, userId))).returning();
    if (done.length === 0) throw new HttpError(404, "Pessoa não encontrada neste evento");
    if (role === "mentor") await db.delete(schema.teamMembers).where(and(eq(schema.teamMembers.eventId, id), eq(schema.teamMembers.userId, userId)));
    await audit(actor.id, "event.member.role", "event", id, { userId, role });
    return { ok: true };
  });

  app.get("/admin/unassigned", async (req) => {
    const e = await getEvent(req);
    const inTeam = db.select({ u: schema.teamMembers.userId }).from(schema.teamMembers).where(eq(schema.teamMembers.eventId, e.id));
    return {
      users: await db.select({ id: schema.users.id, name: schema.users.fullName, school: schema.users.school }).from(schema.eventParticipants)
        .innerJoin(schema.users, eq(schema.users.id, schema.eventParticipants.userId))
        .where(and(eq(schema.eventParticipants.eventId, e.id), eq(schema.eventParticipants.role, "student"), notInArray(schema.users.id, inTeam))),
    };
  });

  // ---- equipes do evento ----
  app.get("/admin/teams", async (req) => {
    const e = await getEvent(req);
    const teams = await db.select({ t: schema.teams, problem: schema.problems.title }).from(schema.teams)
      .leftJoin(schema.problems, eq(schema.problems.id, schema.teams.problemId)).where(eq(schema.teams.eventId, e.id)).orderBy(asc(schema.teams.name));
    const members = await db.select({ teamId: schema.teamMembers.teamId, userId: schema.users.id, name: schema.users.fullName, email: schema.users.email })
      .from(schema.teamMembers).innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId)).where(eq(schema.teamMembers.eventId, e.id));
    const subs = await db.select({ teamId: schema.submissions.teamId, state: schema.submissions.state }).from(schema.submissions)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId)).where(eq(schema.teams.eventId, e.id));
    return {
      teams: teams.map(({ t, problem }) => ({
        id: t.id, name: t.name, description: t.description, problem, inviteCode: t.inviteCode,
        members: members.filter((m) => m.teamId === t.id),
        submitted: subs.filter((s) => s.teamId === t.id && s.state !== "draft").length,
        finalConfirmed: subs.some((s) => s.teamId === t.id && s.state === "final_confirmed"),
      })),
    };
  });

  app.patch("/admin/members", async (req) => {
    const actor = requireRole(req, "organizer");
    const { userId, teamId } = moveMemberSchema.parse(req.body);
    const e = await getEvent(req);
    if (teamId) {
      const [t] = await db.select({ id: schema.teams.id }).from(schema.teams).where(and(eq(schema.teams.id, teamId), eq(schema.teams.eventId, e.id))).limit(1);
      if (!t) throw new HttpError(404, "Equipe não encontrada neste evento");
    }
    await db.transaction(async (tx) => {
      await tx.delete(schema.teamMembers).where(and(eq(schema.teamMembers.userId, userId), eq(schema.teamMembers.eventId, e.id)));
      if (teamId) await tx.insert(schema.teamMembers).values({ teamId, eventId: e.id, userId });
    });
    await audit(actor.id, "member.move", "user", userId, { teamId });
    return { ok: true };
  });

  app.patch("/admin/teams/:id/problem", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id } = idParam.parse(req.params);
    const { problemId } = z.object({ problemId: z.string().uuid().nullable() }).parse(req.body);
    await db.update(schema.teams).set({ problemId }).where(eq(schema.teams.id, id));
    await audit(actor.id, "team.problem.assign", "team", id, { problemId });
    return { ok: true };
  });

  // ---- CRUD de conteúdo (sempre do evento ativo) ----
  const crud = <T extends z.ZodTypeAny>(path: string, table: any, schemaIn: T, extra: (e: { id: string }, actorId: string) => Record<string, unknown>) => {
    app.get(`/admin/${path}`, async (req) => {
      const e = await getEvent(req);
      return { items: await db.select().from(table).where(eq(table.eventId, e.id)) };
    });
    app.post(`/admin/${path}`, async (req, reply) => {
      const actor = requireRole(req, "organizer");
      const e = await getEvent(req);
      const [row] = (await db.insert(table).values({ ...(schemaIn.parse(req.body) as object), ...extra(e, actor.id) }).returning()) as any[];
      await audit(actor.id, `${path}.create`, path, row.id);
      return reply.code(201).send({ item: row });
    });
    app.put(`/admin/${path}/:id`, async (req) => {
      const actor = requireRole(req, "organizer");
      const e = await getEvent(req);
      const { id } = idParam.parse(req.params);
      const [row] = await db.update(table).set(schemaIn.parse(req.body) as object).where(and(eq(table.id, id), eq(table.eventId, e.id))).returning();
      if (!row) throw new HttpError(404, "Item não encontrado");
      await audit(actor.id, `${path}.update`, path, id);
      return { item: row };
    });
    app.delete(`/admin/${path}/:id`, async (req) => {
      const actor = requireRole(req, "organizer");
      const e = await getEvent(req);
      const { id } = idParam.parse(req.params);
      await db.delete(table).where(and(eq(table.id, id), eq(table.eventId, e.id)));
      await audit(actor.id, `${path}.delete`, path, id);
      return { ok: true };
    });
  };
  crud("problems", schema.problems, problemSchema, (e) => ({ eventId: e.id }));
  crud("activities", schema.activities, activitySchema, (e) => ({ eventId: e.id }));
  crud("announcements", schema.announcements, announcementSchema, (e, actor) => ({ eventId: e.id, createdBy: actor }));
  crud("resources", schema.resources, resourceSchema, (e) => ({ eventId: e.id }));
  crud("criteria", schema.criteria, criterionSchema, (e) => ({ eventId: e.id }));

  // ---- entregas ----
  app.get("/admin/submissions", async (req) => {
    const e = await getEvent(req);
    const teams = await db.select({ id: schema.teams.id, name: schema.teams.name }).from(schema.teams).where(eq(schema.teams.eventId, e.id)).orderBy(asc(schema.teams.name));
    const acts = await db.select().from(schema.activities).where(eq(schema.activities.eventId, e.id)).orderBy(asc(schema.activities.dueAt));
    const subs = await db.select({ s: schema.submissions }).from(schema.submissions).innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId)).where(eq(schema.teams.eventId, e.id));
    const now = new Date();
    return {
      activities: acts.map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt, required: a.required })),
      teams: teams.map((t) => ({
        ...t,
        cells: acts.map((a) => {
          const s = subs.find((x) => x.s.teamId === t.id && x.s.activityId === a.id)?.s;
          const due = s?.dueOverride && s.dueOverride > a.dueAt ? s.dueOverride : a.dueAt;
          const done = !!s && s.state !== "draft";
          return {
            activityId: a.id, submissionId: s?.id ?? null, state: s?.state ?? null,
            situation: done ? "concluida" : due < now ? "atrasada" : "pendente",
            verified: !!s?.verifiedAt, brokenLinks: s?.links.filter((l) => l.broken).length ?? 0,
          };
        }),
      })),
    };
  });

  app.post("/admin/submissions/:id/verify", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id } = idParam.parse(req.params);
    await db.update(schema.submissions).set({ verifiedAt: new Date(), verifiedBy: actor.id }).where(eq(schema.submissions.id, id));
    await audit(actor.id, "submission.verify", "submission", id);
    return { ok: true };
  });

  app.post("/admin/submissions/:id/reopen", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id } = idParam.parse(req.params);
    const input = reopenSchema.parse(req.body);
    await db.transaction(async (tx) => {
      await tx.insert(schema.reopenings).values({ submissionId: id, reason: input.reason, newDueAt: input.newDueAt, createdBy: actor.id });
      await tx.update(schema.submissions).set({ dueOverride: input.newDueAt, state: "draft", verifiedAt: null }).where(eq(schema.submissions.id, id));
    });
    await audit(actor.id, "submission.reopen", "submission", id, input);
    return { ok: true };
  });

  // reabrir para equipe que ainda não tem registro de envio
  app.post("/admin/activities/:id/reopen/:teamId", async (req) => {
    const actor = requireRole(req, "organizer");
    const { id, teamId } = z.object({ id: z.string().uuid(), teamId: z.string().uuid() }).parse(req.params);
    const input = reopenSchema.parse(req.body);
    const [s] = await db.insert(schema.submissions).values({ activityId: id, teamId, dueOverride: input.newDueAt }).onConflictDoUpdate({
      target: [schema.submissions.activityId, schema.submissions.teamId], set: { dueOverride: input.newDueAt, state: "draft", verifiedAt: null },
    }).returning();
    await db.insert(schema.reopenings).values({ submissionId: s.id, reason: input.reason, newDueAt: input.newDueAt, createdBy: actor.id });
    await audit(actor.id, "submission.reopen", "submission", s.id, input);
    return { ok: true };
  });

  app.post("/admin/submissions/:id/links/:index/flag", async (req) => {
    const actor = requireRole(req, "organizer");
    const p = z.object({ id: z.string().uuid(), index: z.coerce.number().int().min(0) }).parse(req.params);
    const { broken } = z.object({ broken: z.boolean() }).parse(req.body);
    const [s] = await db.select().from(schema.submissions).where(eq(schema.submissions.id, p.id)).limit(1);
    if (!s || !s.links[p.index]) throw new HttpError(404, "Link não encontrado");
    const links = s.links.map((l, i) => (i === p.index ? { ...l, broken } : l));
    await db.update(schema.submissions).set({ links }).where(eq(schema.submissions.id, p.id));
    await audit(actor.id, "link.flag", "submission", p.id, { index: p.index, broken });
    return { ok: true };
  });

  // ---- resultados (evento ativo) ----
  async function results(eventId: string) {
    const crit = await db.select().from(schema.criteria).where(eq(schema.criteria.eventId, eventId));
    const teams = await db.select({ id: schema.teams.id, name: schema.teams.name }).from(schema.teams).where(eq(schema.teams.eventId, eventId));
    const evals = teams.length ? await db.select().from(schema.evaluations).where(inArray(schema.evaluations.teamId, teams.map((t) => t.id))) : [];
    const totalWeight = crit.reduce((s, c) => s + c.weight, 0) || 1;
    return teams.map((t) => {
      const byJudge = new Map<string, number>();
      for (const j of new Set(evals.filter((e) => e.teamId === t.id).map((e) => e.judgeId))) {
        const sum = crit.reduce((acc, c) => {
          const ev = evals.find((e) => e.teamId === t.id && e.judgeId === j && e.criterionId === c.id);
          return acc + (ev ? (ev.score / c.maxScore) * c.weight : 0);
        }, 0);
        byJudge.set(j, (sum / totalWeight) * 100);
      }
      const scores = [...byJudge.values()];
      return { teamId: t.id, team: t.name, judges: scores.length, score: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : null };
    }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }
  app.get("/admin/results", async (req) => ({ results: await results((await getEvent(req)).id) }));

  app.get("/admin/audit", async () => ({
    entries: await db.select({ a: schema.auditLog, actor: schema.users.displayName }).from(schema.auditLog).leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId)).orderBy(desc(schema.auditLog.createdAt)).limit(200)
      .then((rows) => rows.map((r) => ({ ...r.a, actor: r.actor }))),
  }));

  // ---- exportações (evento ativo) ----
  const sendCsv = (reply: FastifyReply, name: string, rows: (string | number | null | undefined)[][]) =>
    reply.header("Content-Type", "text/csv; charset=utf-8").header("Content-Disposition", `attachment; filename="${name}.csv"`).send(csv(rows));

  app.get("/admin/export/participants.csv", async (req, reply) => {
    const e = await getEvent(req);
    const rows = await db.select({ u: schema.users, role: schema.eventParticipants.role, team: schema.teams.name }).from(schema.eventParticipants)
      .innerJoin(schema.users, eq(schema.users.id, schema.eventParticipants.userId))
      .leftJoin(schema.teamMembers, and(eq(schema.teamMembers.userId, schema.users.id), eq(schema.teamMembers.eventId, e.id)))
      .leftJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId)).where(eq(schema.eventParticipants.eventId, e.id));
    return sendCsv(reply, `inscritos-${e.slug}`, [["Nome", "E-mail", "Perfil", "Escola/Turma", "Faixa etária", "Acessibilidade", "Equipe"],
      ...rows.map(({ u, role, team }) => [u.fullName, u.email, role, u.school, u.ageRange, u.accessibilityNeeds, team])]);
  });

  app.get("/admin/export/teams.csv", async (req, reply) => {
    const e = await getEvent(req);
    const rows = await db.select({ team: schema.teams.name, problem: schema.problems.title, member: schema.users.fullName })
      .from(schema.teams).leftJoin(schema.problems, eq(schema.problems.id, schema.teams.problemId))
      .leftJoin(schema.teamMembers, eq(schema.teamMembers.teamId, schema.teams.id)).leftJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId))
      .where(eq(schema.teams.eventId, e.id));
    return sendCsv(reply, `equipes-${e.slug}`, [["Equipe", "Problema", "Integrante"], ...rows.map((r) => [r.team, r.problem, r.member])]);
  });

  app.get("/admin/export/submissions.csv", async (req, reply) => {
    const e = await getEvent(req);
    const rows = await db.select({ team: schema.teams.name, activity: schema.activities.title, s: schema.submissions }).from(schema.submissions)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId)).innerJoin(schema.activities, eq(schema.activities.id, schema.submissions.activityId))
      .where(eq(schema.teams.eventId, e.id));
    return sendCsv(reply, `entregas-${e.slug}`, [["Equipe", "Atividade", "Situação", "Enviada em", "Conferida pela organização"],
      ...rows.map((r) => [r.team, r.activity, r.s.state, r.s.submittedAt?.toISOString(), r.s.verifiedAt ? "sim" : "não"])]);
  });

  app.get("/admin/export/results.csv", async (req, reply) => {
    const e = await getEvent(req);
    return sendCsv(reply, `resultados-${e.slug}`, [["Equipe", "Avaliadores", "Nota (0-100)"], ...(await results(e.id)).map((r) => [r.team, r.judges, r.score])]);
  });

  app.get("/admin/export/team/:id.zip", async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    if (!team) throw new HttpError(404, "Equipe não encontrada");
    const files = await db.select({ f: schema.files, activity: schema.activities.title }).from(schema.files)
      .innerJoin(schema.activities, eq(schema.activities.id, schema.files.activityId)).where(and(eq(schema.files.teamId, id), eq(schema.files.status, "complete")));
    const subs = await db.select({ s: schema.submissions, activity: schema.activities.title }).from(schema.submissions)
      .innerJoin(schema.activities, eq(schema.activities.id, schema.submissions.activityId)).where(eq(schema.submissions.teamId, id));
    const safe = (s: string) => s.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 80);
    const zip = new ZipArchive({ zlib: { level: 6 } });
    reply.header("Content-Type", "application/zip").header("Content-Disposition", `attachment; filename="${safe(team.name)}.zip"`);
    zip.on("error", (e: Error) => req.log.error(e));
    for (const { s, activity } of subs) {
      zip.append([`# ${activity}`, "", s.textAnswer, "", ...s.links.map((l) => `- ${l.url}${l.broken ? " (link sinalizado como inacessível)" : ""}`)].join("\n"), { name: `${safe(activity)}/resposta.md` });
    }
    (async () => {
      for (const { f, activity } of files) {
        zip.append(await getObjectStream(f.storageKey), { name: `${safe(activity)}/${f.replacedAt ? "substituidos/" : ""}${safe(f.originalName)}` });
      }
      await zip.finalize();
    })().catch((e: unknown) => { zip.abort(); req.log.error(e); });
    return reply.send(zip);
  });
}
