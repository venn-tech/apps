import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@hackaton/shared";
import { Navigate, useLocation } from "react-router-dom";
import { PageLoading } from "@/components/ui/misc";
import { api, get } from "./api";

export interface Me {
  id: string; email: string; fullName: string; displayName: string; role: Role;
  school: string | null; imageConsent: boolean;
}

export function useMe() {
  const q = useQuery({ queryKey: ["me"], queryFn: () => get<{ user: Me | null }>("/auth/me"), staleTime: 60_000 });
  return { me: q.data?.user ?? null, loading: q.isLoading };
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api.post("/auth/logout");
    qc.clear();
    window.location.assign("/");
  };
}

export const homeFor = (role: Role) => ({ student: "/app", mentor: "/app/equipes", organizer: "/app/admin" })[role];

export function RequireAuth({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { me, loading } = useMe();
  const loc = useLocation();
  if (loading) return <PageLoading />;
  if (!me) return <Navigate to="/entrar" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
