import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

await migrate(db, { migrationsFolder: "./drizzle" });
// papéis passam a ser por evento: quem era mentor/banca (global) vira mentor nos eventos em que já participava;
// o papel global fica só para organização (organizer) ou "student" (sem poderes de plataforma)
await pool.query("update event_participants ep set role = 'mentor' from users u where u.id = ep.user_id and u.role in ('mentor', 'judge')");
await pool.query("update users set role = 'student' where role in ('mentor', 'judge')");
await pool.end();
console.log("Migrações aplicadas.");
