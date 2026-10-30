import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { RequireAuth, useMe } from "@/lib/auth";
import { Forgot, Login, Register, RegisterRoute, Reset } from "@/pages/Auth";
import Activities from "@/pages/Activities";
import ActivityDetail from "@/pages/ActivityDetail";
import Dashboard from "@/pages/Dashboard";
import EventsIndex from "@/pages/EventsIndex";
import Landing from "@/pages/Landing";
import MyEvents from "@/pages/MyEvents";
import { ProfilePage } from "@/pages/Profile";
import Problems from "@/pages/Problems";
import { NoticesPage } from "@/pages/Student";
import TeamPage from "@/pages/TeamPage";
import { AdminActivities, AdminAnnouncements, AdminCriteria, AdminProblems, AdminResources } from "@/pages/admin/Content";
import { AdminAudit, AdminEvent, AdminOverview, AdminResults, AdminSubmissions } from "@/pages/admin/Admin";
import { AdminEventMembers, AdminEvents, AdminPeople, AdminTeams } from "@/pages/admin/Events";
import { StaffTeamDetail, StaffTeams } from "@/pages/staff/Staff";

function AppIndex() {
  const { me } = useMe();
  if (me?.role === "organizer") return <Navigate to="/app/admin/eventos" replace />;
  if (me?.role === "mentor") return <Navigate to="/app/equipes" replace />;
  return <Dashboard />;
}

const AdminContent = () => (<><AdminAnnouncements /><div className="h-10" /><AdminResources /></>);

// Rotas só de organização
const org = (el: React.ReactNode) => <RequireAuth roles={["organizer"]}>{el}</RequireAuth>;
const student = (el: React.ReactNode) => <RequireAuth roles={["student"]}>{el}</RequireAuth>;

export default function App() {
  return (
    <Routes>
      {/* público: cada evento tem a sua URL */}
      <Route path="/" element={<EventsIndex />} />
      <Route path="/e/:slug" element={<Landing />} />
      <Route path="/e/:slug/inscrever" element={<RegisterRoute />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/esqueci-senha" element={<Forgot />} />
      <Route path="/redefinir-senha" element={<Reset />} />

      <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<AppIndex />} />
        <Route path="avisos" element={<RequireAuth roles={["student", "mentor"]}><NoticesPage /></RequireAuth>} />
        <Route path="problemas" element={student(<Problems />)} />

        {/* estudante */}
        <Route path="perfil" element={student(<ProfilePage />)} />
        <Route path="eventos" element={<RequireAuth roles={["student", "mentor"]}><MyEvents /></RequireAuth>} />
        <Route path="equipe" element={student(<TeamPage />)} />
        <Route path="atividades" element={student(<Activities />)} />
        <Route path="atividades/:id" element={student(<ActivityDetail />)} />

        {/* mentor (mentoria + avaliação) e organização */}
        <Route path="equipes" element={<RequireAuth roles={["mentor"]}><StaffTeams /></RequireAuth>} />
        <Route path="equipes/:id" element={<RequireAuth roles={["mentor", "organizer"]}><StaffTeamDetail /></RequireAuth>} />

        {/* organização */}
        <Route path="admin" element={org(<AdminOverview />)} />
        <Route path="admin/eventos" element={org(<AdminEvents />)} />
        <Route path="admin/evento" element={org(<AdminEvent />)} />
        <Route path="admin/pessoas" element={org(<AdminPeople />)} />
        <Route path="admin/pessoas/:eventId" element={org(<AdminEventMembers />)} />
        <Route path="admin/equipes" element={org(<AdminTeams />)} />
        <Route path="admin/problemas" element={org(<AdminProblems />)} />
        <Route path="admin/atividades" element={org(<AdminActivities />)} />
        <Route path="admin/entregas" element={org(<AdminSubmissions />)} />
        <Route path="admin/conteudo" element={org(<AdminContent />)} />
        <Route path="admin/avaliacao" element={org(<AdminCriteria />)} />
        <Route path="admin/resultados" element={org(<AdminResults />)} />
        <Route path="admin/auditoria" element={org(<AdminAudit />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
