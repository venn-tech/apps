import { cn } from "@/lib/utils";
import { submissionStatusLabel, type SubmissionStatus } from "@hackaton/shared";

const tones = {
  neutral: "border-line bg-subtle text-muted",
  brand: "border-accent/30 bg-brand-soft text-brand",
  success: "border-success/25 bg-success-soft text-success",
  warn: "border-warn/25 bg-warn-soft text-warn",
  danger: "border-danger/25 bg-danger-soft text-danger",
} as const;

export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const statusTone: Record<SubmissionStatus, keyof typeof tones> = {
  not_started: "neutral", draft: "warn", submitted: "brand", feedback: "success", closed: "danger",
};

export const StatusBadge = ({ status }: { status: SubmissionStatus }) => <Badge tone={statusTone[status]}>{submissionStatusLabel[status]}</Badge>;
