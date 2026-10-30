import { createHash, randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { draftSchema, formatMime, type AcceptedFormat, type SubmissionStatus } from "@hackaton/shared";
import { z } from "zod";
import { db, schema } from "../db/index.js";
import { HttpError, requireRole, requireUser, type SessionUser } from "../lib/auth.js";
import { assertTeamAccess, audit, effectiveDue, getEvent, myTeamId } from "../lib/domain.js";
import { deleteObject, putObject, signedDownloadUrl } from "../lib/storage.js";

type Activity = typeof schema.activities.$inferSelect;
type Submission = typeof schema.submissions.$inferSelect;

export function deriveStatus(a: Activity, s: Submission | undefined, feedbackReleased: boolean): SubmissionStatus {
  const closed = effectiveDue(a.dueAt, s?.dueOverride ?? null) < new Date();
  if (s && s.state !== "draft") return feedbackReleased ? "feedback" : "submitted";
  if (closed) return "closed";
  if (s && (s.textAnswer || s.links.length)) return "draft";
  return s ? "draft" : "not_started";
}

async function teamFiles(teamId: string, activityId: string) {
  return db.select({
    id: schema.files.id, name: schema.files.originalName, mime: schema.files.mime, sizeBytes: schema.files.sizeBytes,
    sha256: schema.files.sha256, createdAt: schema.files.createdAt, replacedAt: schema.files.replacedAt,
    uploadedBy: schema.users.displayName,
  }).from(schema.files)
    .innerJoin(schema.users, eq(schema.users.id, schema.files.uploadedBy))
    .where(and(eq(schema.files.teamId, teamId), eq(schema.files.activityId, activityId), eq(schema.files.status, "complete")))
    .orderBy(asc(schema.files.createdAt));
}

async function loadContext(req: FastifyRequest, user: SessionUser, activityId: string) {
  const [activity] = await db.select().from(schema.activities).where(eq(schema.activities.id, activityId)).limit(1);
  if (!activity) throw new HttpError(404, "Atividade não encontrada");
  if (activity.eventId !== (await getEvent(req)).id) throw new HttpError(404, "Atividade não encontrada");
  const teamId = await myTeamId(user.id, req);
  if (!teamId) throw new HttpError(409, "Entre em uma equipe para trabalhar nesta atividade");
  const [submission] = await db.select().from(schema.submissions).where(and(eq(schema.submissions.activityId, activityId), eq(schema.submissions.teamId, teamId))).limit(1);
  return { activity, teamId, submission };
}

function assertOpen(activity: Activity, submission?: Submission) {
  if (submission?.state === "final_confirmed") throw new HttpError(409, "A entrega final já foi confirmada");
  if (effectiveDue(activity.dueAt, submission?.dueOverride ?? null) < new Date()) {
    throw new HttpError(403, "O prazo desta atividade foi encerrado. Fale com a organização.", "deadline_closed");
  }
}

async function upsertSubmission(activityId: string, teamId: string, patch: Partial<typeof schema.submissions.$inferInsert>) {
  const [s] = await db.insert(schema.submissions).values({ activityId, teamId, ...patch }).onConflictDoUpdate({
    target: [schema.submissions.activityId, schema.submissions.teamId], set: { ...patch, updatedAt: new Date() },
  }).returning();
  return s;
}

async function makeReceipt(submissionId: string, version: number) {
  const [v] = await db.select().from(schema.submissionVersions).where(and(eq(schema.submissionVersions.submissionId, submissionId), eq(schema.submissionVersions.version, version))).limit(1);
  if (!v) throw new HttpError(404, "Comprovante não encontrado");
  const [row] = await db
    .select({ team: schema.teams.name, activity: schema.activities.title })
    .from(schema.submissions)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.submissions.teamId))
    .innerJoin(schema.activities, eq(schema.activities.id, schema.submissions.activityId))
    .where(eq(schema.submissions.id, submissionId)).limit(1);
  return {
    code: `${submissionId.slice(0, 8).toUpperCase()}-${version}`, team: row.team, activity: row.activity,
    kind: v.kind, version, receivedAt: v.createdAt,
    materials: { text: v.textAnswer.length > 0, links: v.links, files: v.files },
  };
}

export async function workRoutes(app: FastifyInstance) {
  app.get("/activities", async (req) => {
    const user = requireUser(req);
    const event = await getEvent(req);
    const acts = await db.select().from(schema.activities).where(eq(schema.activities.eventId, event.id)).orderBy(asc(schema.activities.dueAt), asc(schema.activities.position));
    const teamId = user.role === "student" ? await myTeamId(user.id, req) : null;
    const subs = teamId ? await db.select().from(schema.submissions).where(eq(schema.submissions.teamId, teamId)) : [];
    const [team] = teamId ? await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1) : [];
    return {
      activities: acts.map((a) => {
        const s = subs.find((x) => x.activityId === a.id);
        return {
          ...a,
          dueAt: effectiveDue(a.dueAt, s?.dueOverride ?? null),
          status: teamId ? deriveStatus(a, s, !!team?.feedbackReleasedAt) : null,
          verified: !!s?.verifiedAt,
          finalConfirmed: s?.state === "final_confirmed",
        };
      }),
    };
  });

  app.get("/activities/:id", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    const versions = submission
      ? await db.select({ version: schema.submissionVersions.version, kind: schema.submissionVersions.kind, createdAt: schema.submissionVersions.createdAt, by: schema.users.displayName })
          .from(schema.submissionVersions).innerJoin(schema.users, eq(schema.users.id, schema.submissionVersions.createdBy))
          .where(eq(schema.submissionVersions.submissionId, submission.id)).orderBy(desc(schema.submissionVersions.version))
      : [];
    const all = await teamFiles(teamId, id);
    return {
      activity: { ...activity, dueAt: effectiveDue(activity.dueAt, submission?.dueOverride ?? null) },
      status: deriveStatus(activity, submission, !!team.feedbackReleasedAt),
      verified: !!submission?.verifiedAt,
      submission: submission ? { state: submission.state, textAnswer: submission.textAnswer, links: submission.links, submittedAt: submission.submittedAt, updatedAt: submission.updatedAt } : null,
      files: all.filter((f) => !f.replacedAt),
      removedFiles: all.filter((f) => f.replacedAt),
      versions,
    };
  });

  app.put("/activities/:id/draft", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const input = draftSchema.parse(req.body);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    assertOpen(activity, submission);
    if (!activity.allowText && input.textAnswer) throw new HttpError(422, "Esta atividade não aceita resposta em texto");
    if (!activity.allowLinks && input.links.length) throw new HttpError(422, "Esta atividade não aceita links");
    const links = input.links.map((l) => ({ url: l.url, label: l.label || undefined }));
    const s = await upsertSubmission(id, teamId, { textAnswer: input.textAnswer, links, state: "draft" });
    return { savedAt: s.updatedAt };
  });

  async function validateContent(activity: Activity, s: Submission | undefined, teamId: string) {
    const files = (await teamFiles(teamId, activity.id)).filter((f) => !f.replacedAt);
    const hasText = !!s?.textAnswer.trim();
    const hasLinks = !!s?.links.length;
    if (!hasText && !hasLinks && files.length === 0) throw new HttpError(422, "Adicione uma resposta, um arquivo ou um link antes de enviar");
    if (activity.acceptedFormats.length > 0 && activity.required && files.length === 0 && !hasLinks && !hasText) {
      throw new HttpError(422, "Esta atividade exige um material anexado");
    }
    return files;
  }

  async function snapshot(activity: Activity, s: Submission, teamId: string, userId: string, kind: "submit" | "final") {
    const files = await validateContent(activity, s, teamId);
    const [{ v }] = await db.select({ v: sql<number>`coalesce(max(version), 0)::int` }).from(schema.submissionVersions).where(eq(schema.submissionVersions.submissionId, s.id));
    await db.insert(schema.submissionVersions).values({
      submissionId: s.id, version: v + 1, kind, textAnswer: s.textAnswer, links: s.links.map((l) => ({ url: l.url, label: l.label })),
      files: files.map((f) => ({ id: f.id, name: f.name, sizeBytes: f.sizeBytes, sha256: f.sha256 })), createdBy: userId,
    });
    return v + 1;
  }

  app.post("/activities/:id/submit", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    assertOpen(activity, submission);
    const s = submission ?? (await upsertSubmission(id, teamId, {}));
    const version = await snapshot(activity, s, teamId, user.id, "submit");
    await db.update(schema.submissions).set({ state: "submitted", submittedBy: user.id, submittedAt: new Date(), verifiedAt: null, verifiedBy: null }).where(eq(schema.submissions.id, s.id));
    await audit(user.id, "submission.submit", "submission", s.id, { version });
    return { receipt: await makeReceipt(s.id, version) };
  });

  app.get("/activities/:id/checklist", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    const event = await getEvent(req);
    const acts = await db.select().from(schema.activities).where(and(eq(schema.activities.eventId, event.id), eq(schema.activities.required, true)));
    const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.teamId, teamId));
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    const files = (await teamFiles(teamId, activity.id)).filter((f) => !f.replacedAt);
    return {
      items: [
        { label: "Equipe com problema vinculado", ok: !!team.problemId },
        ...acts.filter((a) => a.id !== id).map((a) => ({ label: a.title, ok: ["submitted", "final_confirmed"].includes(subs.find((s) => s.activityId === a.id)?.state ?? "draft") })),
        { label: "Material da entrega final (texto, link ou arquivo)", ok: !!submission?.textAnswer.trim() || !!submission?.links.length || files.length > 0 },
      ],
    };
  });

  app.post("/activities/:id/confirm-final", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    if (activity.kind !== "final") throw new HttpError(422, "Esta não é a atividade de entrega final");
    assertOpen(activity, submission);
    const s = submission ?? (await upsertSubmission(id, teamId, {}));
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    if (!team.problemId) throw new HttpError(422, "Vincule a equipe a um problema antes da entrega final");
    const version = await snapshot(activity, s, teamId, user.id, "final");
    await db.update(schema.submissions).set({ state: "final_confirmed", submittedBy: user.id, submittedAt: new Date() }).where(eq(schema.submissions.id, s.id));
    await audit(user.id, "submission.final", "submission", s.id, { version });
    return { receipt: await makeReceipt(s.id, version) };
  });

  app.get("/activities/:id/receipt/:version", async (req) => {
    const user = requireRole(req, "student");
    const p = z.object({ id: z.string().uuid(), version: z.coerce.number().int().min(1) }).parse(req.params);
    const { submission } = await loadContext(req, user, p.id);
    if (!submission) throw new HttpError(404, "Nenhum envio encontrado");
    return { receipt: await makeReceipt(submission.id, p.version) };
  });

  // ---- arquivos ----
  app.post("/activities/:id/files", async (req, reply) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { activity, teamId, submission } = await loadContext(req, user, id);
    assertOpen(activity, submission);
    const event = await getEvent(req);
    const maxBytes = event.maxFileMb * 1024 * 1024;
    const part = await req.file({ limits: { fileSize: maxBytes, files: 1 } });
    if (!part) throw new HttpError(400, "Nenhum arquivo recebido");

    const ext = part.filename.split(".").pop()?.toLowerCase() ?? "";
    const allowed = (activity.acceptedFormats.length ? activity.acceptedFormats : Object.keys(formatMime)) as AcceptedFormat[];
    if (!allowed.includes(ext as AcceptedFormat) || !formatMime[ext as AcceptedFormat]?.includes(part.mimetype)) {
      part.file.resume();
      throw new HttpError(415, `Formato não aceito. Use: ${allowed.join(", ").toUpperCase()}`);
    }
    const current = (await teamFiles(teamId, id)).filter((f) => !f.replacedAt);
    if (current.length >= activity.maxFiles) { part.file.resume(); throw new HttpError(409, `Limite de ${activity.maxFiles} anexo(s) nesta atividade. Remova um para enviar outro.`); }
    const [{ used }] = await db.select({ used: sql<number>`coalesce(sum(size_bytes), 0)::float8` }).from(schema.files).where(and(eq(schema.files.teamId, teamId), eq(schema.files.status, "complete")));
    if (used >= event.storageQuotaMb * 1024 * 1024) { part.file.resume(); throw new HttpError(413, "O limite de armazenamento da equipe foi atingido"); }

    const storageKey = `teams/${teamId}/${id}/${randomUUID()}.${ext}`;
    const [row] = await db.insert(schema.files).values({
      teamId, activityId: id, storageKey, originalName: part.filename.slice(0, 200), mime: part.mimetype, uploadedBy: user.id, status: "pending",
    }).returning();

    const hasher = createHash("sha256");
    let size = 0;
    const counter = new Transform({ transform(chunk, _e, cb) { size += chunk.length; hasher.update(chunk); cb(null, chunk); } });
    try {
      await putObject(storageKey, part.file.pipe(counter), "application/octet-stream");
      if (part.file.truncated) throw new HttpError(413, `O arquivo excede o limite de ${event.maxFileMb} MB`);
      if (used + size > event.storageQuotaMb * 1024 * 1024) throw new HttpError(413, "O limite de armazenamento da equipe foi atingido");
    } catch (err) {
      await deleteObject(storageKey).catch(() => {});
      await db.delete(schema.files).where(eq(schema.files.id, row.id));
      if (err instanceof HttpError) throw err;
      req.log.error(err);
      throw new HttpError(502, "Falha ao receber o arquivo. Tente novamente.");
    }
    await db.update(schema.files).set({ status: "complete", sizeBytes: size, sha256: hasher.digest("hex") }).where(eq(schema.files.id, row.id));
    await upsertSubmission(id, teamId, {}).catch(() => {});
    return reply.code(201).send({ file: { id: row.id, name: row.originalName, sizeBytes: size, receivedAt: new Date() } });
  });

  app.delete("/files/:id", async (req) => {
    const user = requireRole(req, "student");
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [f] = await db.select().from(schema.files).where(eq(schema.files.id, id)).limit(1);
    if (!f) throw new HttpError(404, "Arquivo não encontrado");
    await assertTeamAccess(user, f.teamId);
    const { activity, submission } = await loadContext(req, user, f.activityId);
    assertOpen(activity, submission);
    // não apaga do armazenamento: preserva o histórico de versões
    await db.update(schema.files).set({ replacedAt: new Date() }).where(and(eq(schema.files.id, id), isNull(schema.files.replacedAt)));
    return { ok: true };
  });

  app.get("/files/:id/download", async (req) => {
    const user = requireUser(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [f] = await db.select().from(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.status, "complete"))).limit(1);
    if (!f) throw new HttpError(404, "Arquivo não encontrado");
    await assertTeamAccess(user, f.teamId);
    return { url: await signedDownloadUrl(f.storageKey, f.originalName) };
  });
}
