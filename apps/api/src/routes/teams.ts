import { and, count, eq, notInArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
  chooseProblemSchema, joinByCodeSchema, memberEmailSchema, teamCreateSchema, teamUpdateSchema,
} from "@hackaton/shared";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { HttpError, requireRole } from "../lib/auth.js";
import { audit, getEvent, myTeamId, newInviteCode } from "../lib/domain.js";

async function teamView(teamId: string, viewerId: string) {
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  if (!team) throw new HttpError(404, "Equipe não encontrada");
  const members = await db
    .select({ userId: schema.users.id, name: schema.users.displayName, fullName: schema.users.fullName, email: schema.users.email })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.teamMembers.userId))
    .where(eq(schema.teamMembers.teamId, teamId));
  const [problem] = team.problemId ? await db.select().from(schema.problems).where(eq(schema.problems.id, team.problemId)).limit(1) : [];
  const isLeader = team.leaderId === viewerId;
  const requests = isLeader
    ? await db
        .select({ id: schema.joinRequests.id, userId: schema.users.id, name: schema.users.displayName })
        .from(schema.joinRequests)
        .innerJoin(schema.users, eq(schema.users.id, schema.joinRequests.userId))
        .where(and(eq(schema.joinRequests.teamId, teamId), eq(schema.joinRequests.status, "pending")))
    : [];
  return {
    id: team.id, name: team.name, description: team.description, leaderId: team.leaderId,
    inviteCode: isLeader ? team.inviteCode : undefined,
    problem: problem ? { id: problem.id, title: problem.title } : null,
    members, pendingRequests: requests,
  };
}

async function assertFormationOpen(event: Awaited<ReturnType<typeof getEvent>>) {
  if (event.teamFormationDeadline && event.teamFormationDeadline < new Date()) {
    throw new HttpError(403, "O prazo de formação de equipes terminou. Fale com a organização para alterações.");
  }
}

/** Entra na equipe respeitando limite de vagas e "uma equipe por evento". */
async function addMember(teamId: string, userId: string, event: Awaited<ReturnType<typeof getEvent>>) {
  await db.transaction(async (tx) => {
    // trava a linha da equipe para evitar estouro de vagas em entradas simultâneas
    await tx.execute(sql`select id from teams where id = ${teamId} for update`);
    const [{ n }] = await tx.select({ n: count() }).from(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
    if (n >= event.maxTeamSize) throw new HttpError(409, "A equipe já está completa");
    try {
      await tx.insert(schema.teamMembers).values({ teamId, eventId: event.id, userId });
    } catch {
      throw new HttpError(409, "Você já faz parte de uma equipe neste evento");
    }
    await tx.delete(schema.joinRequests).where(eq(schema.joinRequests.userId, userId));
  });
}

export async function teamRoutes(app: FastifyInstance) {
  app.get("/teams/mine", async (req) => {
    const user = requireRole(req, "student");
    const id = await myTeamId(user.id, req);
    return { team: id ? await teamView(id, user.id) : null };
  });

  app.post("/teams", async (req, reply) => {
    const user = requireRole(req, "student");
    const input = teamCreateSchema.parse(req.body);
    const event = await getEvent(req);
    await assertFormationOpen(event);
    if (await myTeamId(user.id, req)) throw new HttpError(409, "Você já faz parte de uma equipe");
    const team = await db.transaction(async (tx) => {
      try {
        const [t] = await tx.insert(schema.teams).values({
          eventId: event.id, name: input.name, description: input.description ?? "", inviteCode: newInviteCode(), leaderId: user.id,
        }).returning();
        await tx.insert(schema.teamMembers).values({ teamId: t.id, eventId: event.id, userId: user.id });
        return t;
      } catch {
        throw new HttpError(409, "Já existe uma equipe com este nome");
      }
    });
    await audit(user.id, "team.create", "team", team.id);
    return reply.code(201).send({ team: await teamView(team.id, user.id) });
  });

  app.patch("/teams/mine", async (req) => {
    const user = requireRole(req, "student");
    const id = await myTeamId(user.id, req);
    if (!id) throw new HttpError(404, "Você ainda não tem equipe");
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    if (t.leaderId !== user.id) throw new HttpError(403, "Só quem criou a equipe pode editá-la");
    const input = teamUpdateSchema.parse(req.body);
    await db.update(schema.teams).set(input).where(eq(schema.teams.id, id));
    return { team: await teamView(id, user.id) };
  });

  app.get("/teams/open", async (req) => {
    const user = requireRole(req, "student");
    const event = await getEvent(req);
    const rows = await db
      .select({
        id: schema.teams.id, name: schema.teams.name, description: schema.teams.description,
        members: sql<number>`(select count(*)::int from team_members m where m.team_id = ${schema.teams.id})`,
        requested: sql<boolean>`exists (select 1 from join_requests r where r.team_id = ${schema.teams.id} and r.user_id = ${user.id} and r.status = 'pending')`,
      })
      .from(schema.teams)
      .where(eq(schema.teams.eventId, event.id));
    return { maxTeamSize: event.maxTeamSize, teams: rows.filter((r) => r.members < event.maxTeamSize).map((r) => ({ ...r, slots: event.maxTeamSize - r.members })) };
  });

  app.post("/teams/join-by-code", async (req) => {
    const user = requireRole(req, "student");
    const { code } = joinByCodeSchema.parse(req.body);
    const event = await getEvent(req);
    await assertFormationOpen(event);
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.inviteCode, code.toUpperCase())).limit(1);
    if (!t) throw new HttpError(404, "Código de convite inválido");
    await addMember(t.id, user.id, event);
    return { team: await teamView(t.id, user.id) };
  });

  app.post("/teams/:id/requests", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const event = await getEvent(req);
    await assertFormationOpen(event);
    if (await myTeamId(user.id, req)) throw new HttpError(409, "Você já faz parte de uma equipe");
    await db.insert(schema.joinRequests).values({ teamId: id, userId: user.id }).onConflictDoUpdate({
      target: [schema.joinRequests.teamId, schema.joinRequests.userId], set: { status: "pending" },
    });
    return { ok: true };
  });

  app.post("/teams/mine/requests/:requestId/:decision", async (req) => {
    const user = requireRole(req, "student");
    const { requestId, decision } = z.object({ requestId: z.string().uuid(), decision: z.enum(["accept", "decline"]) }).parse(req.params);
    const id = await myTeamId(user.id, req);
    const [t] = id ? await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1) : [];
    if (!t || t.leaderId !== user.id) throw new HttpError(403, "Só quem criou a equipe pode decidir");
    const [r] = await db.select().from(schema.joinRequests).where(and(eq(schema.joinRequests.id, requestId), eq(schema.joinRequests.teamId, t.id))).limit(1);
    if (!r || r.status !== "pending") throw new HttpError(404, "Solicitação não encontrada");
    if (decision === "accept") await addMember(t.id, r.userId, await getEvent(req));
    else await db.update(schema.joinRequests).set({ status: "declined" }).where(eq(schema.joinRequests.id, r.id));
    return { team: await teamView(t.id, user.id) };
  });

  app.post("/teams/mine/leave", async (req) => {
    const user = requireRole(req, "student");
    const id = await myTeamId(user.id, req);
    if (!id) throw new HttpError(404, "Você não tem equipe");
    const event = await getEvent(req);
    await assertFormationOpen(event);
    const [t] = await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1);
    await db.transaction(async (tx) => {
      await tx.delete(schema.teamMembers).where(and(eq(schema.teamMembers.teamId, id), eq(schema.teamMembers.userId, user.id)));
      const rest = await tx.select().from(schema.teamMembers).where(eq(schema.teamMembers.teamId, id)).orderBy(schema.teamMembers.joinedAt);
      if (rest.length === 0) {
        const [{ n }] = await tx.select({ n: count() }).from(schema.submissions).where(eq(schema.submissions.teamId, id));
        if (n === 0) await tx.delete(schema.teams).where(eq(schema.teams.id, id));
      } else if (t.leaderId === user.id) {
        await tx.update(schema.teams).set({ leaderId: rest[0].userId }).where(eq(schema.teams.id, id));
      }
    });
    await audit(user.id, "team.leave", "team", id);
    return { ok: true };
  });

  // ---- gestão de integrantes pela líder da equipe (por e-mail) ----
  app.post("/teams/mine/members", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req) => {
    const user = requireRole(req, "student");
    const { email } = memberEmailSchema.parse(req.body);
    const id = await myTeamId(user.id, req);
    const [t] = id ? await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1) : [];
    if (!t || t.leaderId !== user.id) throw new HttpError(403, "Só quem criou a equipe pode adicionar integrantes");
    const event = await getEvent(req);
    await assertFormationOpen(event);
    const [target] = await db.select().from(schema.users).where(and(eq(schema.users.email, email), eq(schema.users.role, "student"))).limit(1);
    if (!target) throw new HttpError(404, "Nenhum estudante inscrito com este e-mail. Peça para a pessoa se cadastrar primeiro.");
    await addMember(t.id, target.id, event);
    await audit(user.id, "team.member.add", "team", t.id, { userId: target.id });
    return { team: await teamView(t.id, user.id) };
  });

  app.delete("/teams/mine/members/:userId", async (req) => {
    const user = requireRole(req, "student");
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    const id = await myTeamId(user.id, req);
    const [t] = id ? await db.select().from(schema.teams).where(eq(schema.teams.id, id)).limit(1) : [];
    if (!t || t.leaderId !== user.id) throw new HttpError(403, "Só quem criou a equipe pode remover integrantes");
    if (userId === user.id) throw new HttpError(422, "Para sair da equipe, use a opção Sair da equipe");
    const event = await getEvent(req);
    await assertFormationOpen(event);
    const removed = await db.delete(schema.teamMembers).where(and(eq(schema.teamMembers.teamId, t.id), eq(schema.teamMembers.userId, userId))).returning();
    if (removed.length === 0) throw new HttpError(404, "Integrante não encontrado nesta equipe");
    await audit(user.id, "team.member.remove", "team", t.id, { userId });
    return { team: await teamView(t.id, user.id) };
  });

  // ---- problemas ----
  app.get("/problems", async (req) => {
    const user = requireRole(req, "student", "mentor", "organizer");
    const event = await getEvent(req);
    const released = user.role !== "student" || (event.problemsPublishedAt && event.problemsPublishedAt <= new Date());
    if (!released) return { released: false, publishedAt: event.problemsPublishedAt, problems: [] };
    const rows = await db
      .select({ p: schema.problems, taken: sql<number>`(select count(*)::int from teams t where t.problem_id = ${schema.problems.id})` })
      .from(schema.problems)
      .where(and(eq(schema.problems.eventId, event.id), user.role === "student" ? eq(schema.problems.published, true) : undefined));
    return {
      released: true, mode: event.problemMode, maxTeamsPerProblem: event.maxTeamsPerProblem,
      problems: rows.map(({ p, taken }) => ({ ...p, teamsCount: taken })),
    };
  });

  app.post("/teams/mine/problem", async (req) => {
    const user = requireRole(req, "student");
    const { problemId } = chooseProblemSchema.parse(req.body);
    const event = await getEvent(req);
    if (event.problemMode !== "free") throw new HttpError(403, "Os problemas serão atribuídos pela organização");
    if (!event.problemsPublishedAt || event.problemsPublishedAt > new Date()) throw new HttpError(403, "Os problemas ainda não foram divulgados");
    const id = await myTeamId(user.id, req);
    if (!id) throw new HttpError(404, "Crie ou entre em uma equipe primeiro");
    const [p] = await db.select().from(schema.problems).where(and(eq(schema.problems.id, problemId), eq(schema.problems.published, true))).limit(1);
    if (!p) throw new HttpError(404, "Problema não encontrado");
    if (event.maxTeamsPerProblem) {
      const [{ n }] = await db.select({ n: count() }).from(schema.teams).where(and(eq(schema.teams.problemId, problemId), sql`${schema.teams.id} <> ${id}`));
      if (n >= event.maxTeamsPerProblem) throw new HttpError(409, "Este problema já atingiu o limite de equipes");
    }
    await db.update(schema.teams).set({ problemId }).where(eq(schema.teams.id, id));
    await audit(user.id, "team.problem", "team", id, { problemId });
    return { team: await teamView(id, user.id) };
  });
}
