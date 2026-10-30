import * as React from "react";
import { cn } from "@/lib/utils";

const base = "w-full rounded-md border border-line bg-transparent px-3 text-sm text-ink shadow-xs placeholder:text-muted/70 transition focus-visible:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(base, "h-10", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-28 py-2.5 leading-relaxed", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(base, "h-10 bg-surface pr-3", className)} {...p} />
));
Select.displayName = "Select";

export function Field({ label, required, hint, error, htmlFor, children }: { label: string; required?: boolean; hint?: string; error?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label">
        {label} {required && <span className="text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
