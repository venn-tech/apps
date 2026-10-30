import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { evaluationSchema, mentorNoteSchema } from "@hackaton/shared";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { HttpError, requireRole } from "../lib/auth.js";
import { assertTeamAccess, audit, getEvent } from "../lib/domain.js";

const idParam = z.object({ id: z.string().uuid() });

// Mentor (inclui o antigo papel de banca) e organização: acompanham as equipes do evento ativo.
export async function staffRoutes(app: FastifyInstance) {
  app.get("/staff/teams", async (req) => {
    requireRole(req, "mentor", "organizer");
    const event = await getEvent(req);
    const teams = await db.select({ id: schema.teams.id, name: schema.teams.name, problem: schema.problems.title })
      .from(schema.teams).leftJoin(schema.problems, eq(schema.problems.id, schema.teams.problemId))
      .where(eq(schema.teams.eventId, event.id)).orderBy(asc(schema.teams.name));
    const subs = await db.select({ teamId: schema.submissions.teamId, state: schema.submissions.state }).from(schema.submissions)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId)).where(eq(schema.teams.eventId, event.id));
    const members = await db.select({ teamId: schema.teamMembers.teamId, name: schema.users.displayName }).from(schema.teamMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId)).where(eq(schema.teamMembers.eventId, event.id));
    return {
      teams: teams.map((t) => ({
        ...t,
        members: members.filter((m) => m.teamId === t.id).map((m) => m.name),
        submitted: subs.filter((s) => s.teamId === t.id && s.state !== "draft").length,
      })),
    };
  });

  // trabalho completo de uma equipe
  app.get("/staff/teams/:id", async (req) => {
    const user = requireRole(req, "mentor", "organizer");
    const { id } = idParam.parse(req.params);
    await assertTeamAccess(user, id);
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    if (!team) throw new HttpError(404, "Equipe não encontrada");
    const [problem] = team.problemId ? await db.select().from(schema.problems).where(eq(schema.problems.id, team.problemId)).limit(1) : [];
    const members = await db.select({ name: schema.users.displayName, fullName: schema.users.fullName, email: schema.users.email })
      .from(schema.teamMembers).innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId)).where(eq(schema.teamMembers.teamId, id));
    // Só o que foi ENTREGUE: rascunhos (texto, links e arquivos ainda não enviados) nunca aparecem para a mentoria.
    // Mostramos a última versão entregue, mesmo que a equipe já esteja editando de novo.
    const acts = await db.select().from(schema.activities).where(eq(schema.activities.eventId, team.eventId)).orderBy(asc(schema.activities.dueAt));
    const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.teamId, id));
    const versions = subs.length
      ? await db.select().from(schema.submissionVersions).where(inArray(schema.submissionVersions.submissionId, subs.map((x) => x.id))).orderBy(desc(schema.submissionVersions.version))
      : [];
    const work = acts.map((a) => {
      const sub = subs.find((x) => x.activityId === a.id);
      const v = sub ? versions.find((x) => x.submissionId === sub.id) : undefined;
      return {
        activity: { id: a.id, title: a.title, kind: a.kind, dueAt: a.dueAt },
        delivered: v && sub ? { version: v.version, kind: v.kind, deliveredAt: v.createdAt, text: v.textAnswer, links: v.links, files: v.files, verified: !!sub.verifiedAt } : null,
      };
    });
    const notes = await db.select({ id: schema.mentorNotes.id, body: schema.mentorNotes.body, createdAt: schema.mentorNotes.createdAt, mentor: schema.users.displayName })
      .from(schema.mentorNotes).innerJoin(schema.users, eq(schema.users.id, schema.mentorNotes.mentorId)).where(eq(schema.mentorNotes.teamId, id)).orderBy(desc(schema.mentorNotes.createdAt));
    return {
      team: { id: team.id, name: team.name, description: team.description }, problem: problem ?? null, members,
      work,
      notes,
    };
  });

  app.post("/staff/teams/:id/notes", async (req, reply) => {
    const user = requireRole(req, "mentor", "organizer");
    const { id } = idParam.parse(req.params);
    await assertTeamAccess(user, id);
    const { body } = mentorNoteSchema.parse(req.body);
    const [n] = await db.insert(schema.mentorNotes).values({ teamId: id, mentorId: user.id, body }).returning();
    return reply.code(201).send({ note: n });
  });

  // ---- avaliação (mentor) ----
  app.get("/staff/criteria", async (req) => {
    requireRole(req, "mentor", "organizer");
    const e = await getEvent(req);
    return { criteria: await db.select().from(schema.criteria).where(eq(schema.criteria.eventId, e.id)) };
  });

  app.get("/staff/teams/:id/evaluation", async (req) => {
    const user = requireRole(req, "mentor");
    const { id } = idParam.parse(req.params);
    await assertTeamAccess(user, id);
    const scores = await db.select().from(schema.evaluations).where(and(eq(schema.evaluations.teamId, id), eq(schema.evaluations.judgeId, user.id)));
    const [fb] = await db.select().from(schema.evaluationFeedback).where(and(eq(schema.evaluationFeedback.teamId, id), eq(schema.evaluationFeedback.judgeId, user.id))).limit(1);
    return { scores, strengths: fb?.strengths ?? "", improvements: fb?.improvements ?? "" };
  });

  app.put("/staff/teams/:id/evaluation", async (req) => {
    const user = requireRole(req, "mentor");
    const { id } = idParam.parse(req.params);
    await assertTeamAccess(user, id);
    const input = evaluationSchema.parse(req.body);
    const [team] = await db.select({ eventId: schema.teams.eventId }).from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    const crit = await db.select().from(schema.criteria).where(eq(schema.criteria.eventId, team.eventId));
    for (const s of input.scores) {
      const c = crit.find((x) => x.id === s.criterionId);
      if (!c) throw new HttpError(422, "Critério inválido");
      if (s.score > c.maxScore) throw new HttpError(422, `A nota de "${c.name}" não pode passar de ${c.maxScore}`);
    }
    await db.transaction(async (tx) => {
      for (const s of input.scores) {
        await tx.insert(schema.evaluations).values({ teamId: id, judgeId: user.id, criterionId: s.criterionId, score: s.score, comment: s.comment })
          .onConflictDoUpdate({ target: [schema.evaluations.teamId, schema.evaluations.judgeId, schema.evaluations.criterionId], set: { score: s.score, comment: s.comment } });
      }
      await tx.insert(schema.evaluationFeedback).values({ teamId: id, judgeId: user.id, strengths: input.strengths, improvements: input.improvements })
        .onConflictDoUpdate({ target: [schema.evaluationFeedback.teamId, schema.evaluationFeedback.judgeId], set: { strengths: input.strengths, improvements: input.improvements } });
    });
    await audit(user.id, "evaluation.save", "team", id);
    return { ok: true };
  });
}
