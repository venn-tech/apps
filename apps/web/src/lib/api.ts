import axios, { AxiosError } from "axios";

// Em desenvolvimento o Vite faz proxy de /api. Em produção, com front e API em subdomínios do mesmo domínio,
// defina VITE_API_URL (ex.: https://api.seudominio.com/api).
const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || "/api").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_BASE}${path.replace(/^\/api/, "")}`;

export const api = axios.create({ baseURL: API_BASE, withCredentials: true });

// Evento ativo (seletor de evento): enviado em todas as chamadas.
const EVENT_KEY = "event-id";
export const getActiveEventId = () => { try { return localStorage.getItem(EVENT_KEY); } catch { return null; } };
export const setActiveEventId = (id: string | null) => { try { id ? localStorage.setItem(EVENT_KEY, id) : localStorage.removeItem(EVENT_KEY); } catch { /* ignora */ } };
api.interceptors.request.use((cfg) => { const id = getActiveEventId(); if (id) cfg.headers.set("X-Event-Id", id); return cfg; });

export function errorMessage(err: unknown, fallback = "Algo deu errado. Tente novamente.") {
  if (err instanceof AxiosError) {
    if (!err.response) return "Sem conexão com o servidor. Seu texto continua salvo neste aparelho; tente de novo.";
    return (err.response.data as { error?: string } | undefined)?.error ?? fallback;
  }
  return fallback;
}

export const get = <T,>(url: string) => api.get<T>(url).then((r) => r.data);

/** Links de download (CSV/ZIP) não enviam cabeçalhos: o evento vai na URL. */
export const exportUrl = (path: string) => { const id = getActiveEventId(); return apiUrl(id ? `${path}${path.includes("?") ? "&" : "?"}eventId=${id}` : path); };

import type { QueryClient } from "@tanstack/react-query";

/** Troca o evento ativo: limpa o cache (exceto "my-events") e recarrega a sessão, pois o papel muda por evento. */
export function activateEvent(qc: QueryClient, id: string | null) {
  setActiveEventId(id);
  qc.removeQueries({ predicate: (q) => !["me", "my-events"].includes(String(q.queryKey[0])) });
  qc.invalidateQueries({ queryKey: ["me"] });
  qc.invalidateQueries({ queryKey: ["my-events"] });
}
