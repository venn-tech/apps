import { z } from "zod";

export const roles = ["student", "mentor", "organizer"] as const;
export type Role = (typeof roles)[number];

export const submissionStatuses = ["not_started", "draft", "submitted", "feedback", "closed"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const submissionStatusLabel: Record<SubmissionStatus, string> = {
  not_started: "Não iniciada",
  draft: "Em elaboração",
  submitted: "Enviada",
  feedback: "Com devolutiva",
  closed: "Prazo encerrado",
};

export const acceptedFormats = ["pdf", "docx", "pptx", "jpg", "png", "mp4", "zip"] as const;
export type AcceptedFormat = (typeof acceptedFormats)[number];

export const formatMime: Record<AcceptedFormat, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  jpg: ["image/jpeg"],
  png: ["image/png"],
  mp4: ["video/mp4"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

const password = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(128);

export const registerSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo").max(120),
  displayName: z.string().trim().min(1, "Informe como quer ser chamado").max(40),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password,
  school: z.string().trim().max(120).optional().or(z.literal("")),
  ageRange: z.enum(["under_18", "18_plus"]).optional(),
  accessibilityNeeds: z.string().trim().max(500).optional().or(z.literal("")),
  acceptRules: z.literal(true, { message: "É preciso aceitar as regras de participação" }),
  acceptPrivacy: z.literal(true, { message: "É preciso ciência do aviso de privacidade" }),
  guardianConsent: z.boolean().optional(),
  eventSlug: z.string().trim().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
export const resetSchema = z.object({ token: z.string().min(20), password });

export const teamCreateSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à equipe").max(60),
  description: z.string().trim().max(400).optional().or(z.literal("")),
});
export const teamUpdateSchema = teamCreateSchema.partial();
export const joinByCodeSchema = z.object({ code: z.string().trim().min(4).max(20) });
export const memberEmailSchema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido") });
export const chooseProblemSchema = z.object({ problemId: z.string().uuid() });

export const linkSchema = z.object({
  url: z.string().trim().url("Link inválido").max(500),
  label: z.string().trim().max(80).optional().or(z.literal("")),
});
export const draftSchema = z.object({
  textAnswer: z.string().max(20000).default(""),
  links: z.array(linkSchema).max(10).default([]),
});
export type DraftInput = z.infer<typeof draftSchema>;

export const mentorNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens").min(3).max(60);

export const eventCreateSchema = z.object({
  name: z.string().trim().min(3, "Dê um nome ao evento").max(120),
  slug: slugSchema.optional(),
  description: z.string().max(4000).default(""),
  location: z.string().max(200).default(""),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const eventUpdateSchema = z.object({
  slug: slugSchema.optional(),
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().max(4000).optional(),
  location: z.string().max(200).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  registrationOpen: z.boolean().optional(),
  minTeamSize: z.number().int().min(1).max(20).optional(),
  maxTeamSize: z.number().int().min(1).max(20).optional(),
  allowMixedClasses: z.boolean().optional(),
  problemMode: z.enum(["free", "assigned"]).optional(),
  maxTeamsPerProblem: z.number().int().min(1).nullable().optional(),
  problemsPublishedAt: z.coerce.date().nullable().optional(),
  teamFormationDeadline: z.coerce.date().nullable().optional(),
  maxFileMb: z.number().int().min(1).max(2048).optional(),
  storageQuotaMb: z.number().int().min(1).max(20480).optional(),
  schedule: z.array(z.object({ day: z.string(), time: z.string(), title: z.string(), description: z.string().optional() })).optional(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  rulesUrl: z.string().url().nullable().optional(),
});

export const problemSchema = z.object({
  title: z.string().trim().min(3).max(160),
  context: z.string().max(8000).default(""),
  affected: z.string().max(2000).default(""),
  question: z.string().max(1000).default(""),
  references: z.string().max(4000).default(""),
  constraints: z.string().max(4000).default(""),
  resources: z.string().max(4000).default(""),
  deliverables: z.string().max(4000).default(""),
  criteria: z.string().max(4000).default(""),
  published: z.boolean().default(true),
});

export const activitySchema = z.object({
  title: z.string().trim().min(3).max(160),
  objective: z.string().max(2000).default(""),
  instructions: z.string().max(8000).default(""),
  kind: z.enum(["activity", "final", "reflection"]).default("activity"),
  dueAt: z.coerce.date(),
  required: z.boolean().default(true),
  allowText: z.boolean().default(true),
  allowLinks: z.boolean().default(true),
  acceptedFormats: z.array(z.enum(acceptedFormats)).default([]),
  maxFiles: z.number().int().min(0).max(20).default(3),
  position: z.number().int().default(0),
});

export const announcementSchema = z.object({ title: z.string().trim().min(2).max(160), body: z.string().trim().min(1).max(4000) });
export const resourceSchema = z.object({ title: z.string().trim().min(2).max(160), url: z.string().url(), description: z.string().max(400).default("") });
export const criterionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(400).default(""),
  weight: z.number().min(0).max(100).default(1),
  maxScore: z.number().int().min(1).max(100).default(10),
});
export const reopenSchema = z.object({ reason: z.string().trim().min(5).max(500), newDueAt: z.coerce.date() });
export const evaluationSchema = z.object({
  scores: z.array(z.object({ criterionId: z.string().uuid(), score: z.number().min(0), comment: z.string().max(1000).default("") })),
  strengths: z.string().max(3000).default(""),
  improvements: z.string().max(3000).default(""),
});
export const eventRoles = ["student", "mentor"] as const;
export const eventRoleSchema = z.object({ role: z.enum(eventRoles) });
export const eventMemberSchema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido"), role: z.enum(eventRoles).default("student") });
export const roleSchema = z.object({ role: z.enum(roles) });
export const moveMemberSchema = z.object({ userId: z.string().uuid(), teamId: z.string().uuid().nullable() });
