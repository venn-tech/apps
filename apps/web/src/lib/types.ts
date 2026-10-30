import type { SubmissionStatus } from "@hackaton/shared";

export interface Activity {
  id: string; title: string; objective: string; instructions: string; kind: "activity" | "final" | "reflection";
  dueAt: string; required: boolean; allowText: boolean; allowLinks: boolean; acceptedFormats: string[]; maxFiles: number; position: number;
  status: SubmissionStatus | null; verified?: boolean; finalConfirmed?: boolean;
}

export interface FileItem { id: string; name: string; mime: string; sizeBytes: number; sha256: string | null; createdAt: string; replacedAt: string | null; uploadedBy: string }

export interface Receipt {
  code: string; team: string; activity: string; kind: string; version: number; receivedAt: string;
  materials: { text: boolean; links: { url: string; label?: string }[]; files: { id: string; name: string; sizeBytes: number; sha256: string | null }[] };
}

export interface Team {
  id: string; name: string; description: string; leaderId: string; inviteCode?: string;
  problem: { id: string; title: string } | null;
  members: { userId: string; name: string; fullName: string; email: string }[];
  pendingRequests: { id: string; userId: string; name: string }[];
}

export interface Problem {
  id: string; title: string; context: string; affected: string; question: string; references: string; constraints: string;
  resources: string; deliverables: string; criteria: string; published: boolean; teamsCount?: number;
}

export interface Announcement { id: string; title: string; body: string; createdAt: string }
export interface ResourceItem { id: string; title: string; url: string; description: string }
