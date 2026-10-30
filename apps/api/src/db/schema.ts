import { sql } from "drizzle-orm";
import {
  bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const roleEnum = pgEnum("role", ["student", "mentor", "judge", "organizer"]);
export const problemModeEnum = pgEnum("problem_mode", ["free", "assigned"]);
export const activityKindEnum = pgEnum("activity_kind", ["activity", "final", "reflection"]);
export const submissionStateEnum = pgEnum("submission_state", ["draft", "submitted", "final_confirmed"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "accepted", "declined"]);
export const fileStatusEnum = pgEnum("file_status", ["pending", "complete"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull().default("student"),
  school: text("school"),
  ageRange: text("age_range"),
  accessibilityNeeds: text("accessibility_needs"),
  rulesAcceptedAt: ts("rules_accepted_at"),
  privacyAcceptedAt: ts("privacy_accepted_at"),
  guardianConsentAt: ts("guardian_consent_at"),
  imageConsentAt: ts("image_consent_at"), // separado da participação e do envio
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
});

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
});

export const events = pgTable("events", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  registrationOpen: boolean("registration_open").notNull().default(true),
  minTeamSize: integer("min_team_size").notNull().default(3),
  maxTeamSize: integer("max_team_size").notNull().default(5),
  allowMixedClasses: boolean("allow_mixed_classes").notNull().default(true),
  problemMode: problemModeEnum("problem_mode").notNull().default("free"),
  maxTeamsPerProblem: integer("max_teams_per_problem"),
  problemsPublishedAt: ts("problems_published_at"),
  teamFormationDeadline: ts("team_formation_deadline"),
  maxFileMb: integer("max_file_mb").notNull().default(100),
  storageQuotaMb: integer("storage_quota_mb").notNull().default(500),
  rulesUrl: text("rules_url"),
  schedule: jsonb("schedule").$type<{ day: string; time: string; title: string; description?: string }[]>().notNull().default([]),
  faq: jsonb("faq").$type<{ q: string; a: string }[]>().notNull().default([]),
  createdAt: createdAt(),
});

export const eventParticipants = pgTable("event_participants", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // papel da pessoa NESTE evento (a mesma pessoa pode ser aluna num e mentora noutro)
  role: roleEnum("role").notNull().default("student"),
  joinedAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] })]);

export const problems = pgTable("problems", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  context: text("context").notNull().default(""),
  affected: text("affected").notNull().default(""),
  question: text("question").notNull().default(""),
  references: text("references").notNull().default(""),
  constraints: text("constraints").notNull().default(""),
  resources: text("resources").notNull().default(""),
  deliverables: text("deliverables").notNull().default(""),
  criteria: text("criteria").notNull().default(""),
  published: boolean("published").notNull().default(true),
  createdAt: createdAt(),
});

export const teams = pgTable("teams", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  inviteCode: text("invite_code").notNull().unique(),
  leaderId: uuid("leader_id").notNull().references(() => users.id),
  problemId: uuid("problem_id").references(() => problems.id, { onDelete: "set null" }),
  feedbackReleasedAt: ts("feedback_released_at"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("teams_event_name_uq").on(t.eventId, sql`lower(${t.name})`)]);

export const teamMembers = pgTable("team_members", {
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contribution: text("contribution").notNull().default(""),
  joinedAt: createdAt(),
}, (t) => [
  primaryKey({ columns: [t.teamId, t.userId] }),
  uniqueIndex("one_team_per_event").on(t.eventId, t.userId),
]);

export const joinRequests = pgTable("join_requests", {
  id: id(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: requestStatusEnum("status").notNull().default("pending"),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("join_request_uq").on(t.teamId, t.userId)]);

export const activities = pgTable("activities", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  objective: text("objective").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  kind: activityKindEnum("kind").notNull().default("activity"),
  dueAt: ts("due_at").notNull(),
  required: boolean("required").notNull().default(true),
  allowText: boolean("allow_text").notNull().default(true),
  allowLinks: boolean("allow_links").notNull().default(true),
  acceptedFormats: text("accepted_formats").array().notNull().default(sql`'{}'::text[]`),
  maxFiles: integer("max_files").notNull().default(3),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
});

export const submissions = pgTable("submissions", {
  id: id(),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  state: submissionStateEnum("state").notNull().default("draft"),
  textAnswer: text("text_answer").notNull().default(""),
  links: jsonb("links").$type<{ url: string; label?: string; broken?: boolean }[]>().notNull().default([]),
  dueOverride: ts("due_override"), // reabertura registrada
  submittedBy: uuid("submitted_by").references(() => users.id),
  submittedAt: ts("submitted_at"),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: ts("verified_at"), // "recebida" difere de "conferida pela organização"
  updatedAt: ts("updated_at").notNull().defaultNow(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("submission_uq").on(t.activityId, t.teamId)]);

export const submissionVersions = pgTable("submission_versions", {
  id: id(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  kind: text("kind").notNull(), // submit | final
  textAnswer: text("text_answer").notNull(),
  links: jsonb("links").$type<{ url: string; label?: string }[]>().notNull(),
  files: jsonb("files").$type<{ id: string; name: string; sizeBytes: number; sha256: string | null }[]>().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("submission_version_uq").on(t.submissionId, t.version)]);

export const files = pgTable("files", {
  id: id(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  activityId: uuid("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  sha256: text("sha256"),
  status: fileStatusEnum("status").notNull().default("pending"),
  uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
  replacedAt: ts("replaced_at"), // histórico preservado: arquivo removido/substituído não é apagado
  createdAt: createdAt(),
}, (t) => [index("files_team_activity").on(t.teamId, t.activityId)]);

export const helpRequests = pgTable("help_requests", {
  id: id(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  response: text("response"),
  respondedBy: uuid("responded_by").references(() => users.id),
  respondedAt: ts("responded_at"),
  createdAt: createdAt(),
});

export const mentorNotes = pgTable("mentor_notes", {
  id: id(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  mentorId: uuid("mentor_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const assignments = pgTable("assignments", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.teamId] })]);

export const announcements = pgTable("announcements", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const resources = pgTable("resources", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
});

export const criteria = pgTable("criteria", {
  id: id(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  weight: real("weight").notNull().default(1),
  maxScore: integer("max_score").notNull().default(10),
});

export const evaluations = pgTable("evaluations", {
  id: id(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  judgeId: uuid("judge_id").notNull().references(() => users.id),
  criterionId: uuid("criterion_id").notNull().references(() => criteria.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  comment: text("comment").notNull().default(""),
}, (t) => [uniqueIndex("evaluation_uq").on(t.teamId, t.judgeId, t.criterionId)]);

export const evaluationFeedback = pgTable("evaluation_feedback", {
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  judgeId: uuid("judge_id").notNull().references(() => users.id),
  strengths: text("strengths").notNull().default(""),
  improvements: text("improvements").notNull().default(""),
}, (t) => [primaryKey({ columns: [t.teamId, t.judgeId] })]);

export const reopenings = pgTable("reopenings", {
  id: id(),
  submissionId: uuid("submission_id").notNull().references(() => submissions.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  newDueAt: ts("new_due_at").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  data: jsonb("data"),
  createdAt: createdAt(),
});
