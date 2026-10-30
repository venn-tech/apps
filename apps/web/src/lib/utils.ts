import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "—";
export const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const toLocalInput = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

/** "06 e 07 de novembro" quando no mesmo mês; senão "30 de outubro a 02 de novembro". */
export function fmtRange(a: string | Date | null | undefined, b: string | Date | null | undefined) {
  if (!a || !b) return "Datas a definir";
  const x = new Date(a), y = new Date(b);
  const d = (v: Date) => String(v.getDate()).padStart(2, "0");
  const m = (v: Date) => v.toLocaleDateString("pt-BR", { month: "long" });
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return d(x) === d(y) ? `${d(x)} de ${m(x)}` : `${d(x)} e ${d(y)} de ${m(x)}`;
  return `${d(x)} de ${m(x)} a ${d(y)} de ${m(y)}`;
}
