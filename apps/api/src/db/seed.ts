import { eq } from "drizzle-orm";
import { env } from "../env.js";
import { hashPassword } from "../lib/auth.js";
import { db, pool, schema } from "./index.js";

// Dados de exemplo: mês, horários, local e regras ainda serão definidos pela organização.
const now = new Date();
const day = (d: number, h: number, m = 0) => new Date(now.getFullYear(), now.getMonth() + 1, d, h, m);

// A conta da organização acompanha sempre o .env (cria ou atualiza e-mail/senha).
const adminHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
const [existingAdmin] = await db.select().from(schema.users).where(eq(schema.users.role, "organizer")).limit(1);
let admin = existingAdmin;
if (admin) {
  [admin] = await db.update(schema.users).set({ email: env.SEED_ADMIN_EMAIL, passwordHash: adminHash }).where(eq(schema.users.id, admin.id)).returning();
} else {
  [admin] = await db.insert(schema.users).values({
    email: env.SEED_ADMIN_EMAIL, passwordHash: adminHash, fullName: "Organização", displayName: "Organização", role: "organizer",
    rulesAcceptedAt: new Date(), privacyAcceptedAt: new Date(),
  }).returning();
}

const [existing] = await db.select().from(schema.events).limit(1);
if (existing) {
  console.log(`Evento já existe; conta da organização sincronizada com o .env (${env.SEED_ADMIN_EMAIL}).`);
  await pool.end();
  process.exit(0);
}

const [event] = await db.insert(schema.events).values({
  slug: "hackathon-oficina-de-negocios-cloc",
  name: "Hackathon Oficina de Negócios + CLOC",
  description:
    "Experiência colaborativa de criação de soluções para problemas apresentados pela organização. Em grupos, com apoio de mentorias, você investiga o desafio, desenvolve uma ideia e constrói uma proposta usando o que aprendeu na formação.",
  location: "A definir",
  startsAt: day(6, 8),
  endsAt: day(7, 18),
  minTeamSize: 3,
  maxTeamSize: 5,
  teamFormationDeadline: day(6, 11),
  problemsPublishedAt: day(6, 9),
  schedule: [
    { day: "Dia 06", time: "Manhã", title: "Acolhimento e abertura", description: "Apresentação dos problemas, regras e formação dos grupos." },
    { day: "Dia 06", time: "Manhã", title: "Início do desenvolvimento", description: "Investigação, planejamento e mentorias." },
    { day: "Dia 07", time: "Manhã", title: "Aprimoramento e protótipo", description: "Ajustes após mentoria e construção do protótipo." },
    { day: "Dia 07", time: "Manhã e tarde", title: "Preparação do pitch" },
    { day: "Dia 07", time: "Tarde", title: "Entrega final, apresentações e devolutivas" },
  ],
  faq: [
    { q: "Preciso ter uma conta Google?", a: "Não. Você cria sua conta com e-mail e senha." },
    { q: "Posso trocar de equipe?", a: "Até o fim do prazo de formação, sim. Depois, fale com a organização." },
    { q: "O que levar?", a: "Notebook ou celular, carregador e o que você usa para prototipar." },
  ],
}).returning();

await db.insert(schema.eventParticipants).values({ eventId: event.id, userId: admin.id });

await db.insert(schema.problems).values([
  { eventId: event.id, title: "Problema de exemplo 1", question: "Como podemos ...?", context: "Descreva o contexto aqui." },
  { eventId: event.id, title: "Problema de exemplo 2", question: "Como podemos ...?", context: "Descreva o contexto aqui." },
]);

await db.insert(schema.activities).values([
  { eventId: event.id, position: 1, title: "Formação da equipe", objective: "Registrar nome do grupo e integrantes.", instructions: "Crie ou entre em uma equipe na aba Equipe.", dueAt: day(6, 10), allowText: true, acceptedFormats: [], maxFiles: 0 },
  { eventId: event.id, position: 2, title: "Compreensão do problema", objective: "Entender quem é afetado e o que falta investigar.", instructions: "Qual problema será enfrentado? Quem é afetado? Que informações ainda precisam ser investigadas?", dueAt: day(6, 11, 30) },
  { eventId: event.id, position: 3, title: "Proposta inicial", objective: "Descrever a ideia, o público e a contribuição esperada.", instructions: "Escreva a ideia da solução, o público e o benefício esperado.", dueAt: day(6, 12) },
  { eventId: event.id, position: 4, title: "Organização do trabalho", objective: "Dividir tarefas e escolher ferramentas.", instructions: "Quem faz o quê? Quais ferramentas vocês vão usar?", dueAt: day(6, 12, 30) },
  { eventId: event.id, position: 5, title: "Aprimoramento da proposta", objective: "Registrar ajustes após a investigação e a mentoria.", instructions: "O que mudou na ideia depois das conversas?", dueAt: day(7, 10), required: false },
  { eventId: event.id, position: 6, title: "Protótipo (primeira versão)", objective: "Mostrar a primeira versão da solução.", instructions: "Envie imagens, arquivo ou link para demonstração.", dueAt: day(7, 12), acceptedFormats: ["png", "jpg", "pdf", "mp4", "zip"], maxFiles: 5 },
  { eventId: event.id, position: 7, title: "Entrega final: pitch e protótipo", kind: "final", objective: "Entregar a versão que será avaliada.", instructions: "Apresentação, protótipo e demais materiais obrigatórios.", dueAt: day(7, 15), acceptedFormats: ["pdf", "pptx", "png", "jpg", "mp4", "zip"], maxFiles: 8 },
  { eventId: event.id, position: 8, title: "Reflexão sobre a experiência", kind: "reflection", objective: "Registrar contribuições e aprendizados.", instructions: "O que cada integrante fez e aprendeu?", dueAt: day(7, 17), required: false, acceptedFormats: [], maxFiles: 0 },
]);

await db.insert(schema.criteria).values([
  ["Compreensão do problema", "A equipe explica a dificuldade e o público afetado?"],
  ["Coerência da solução", "A proposta responde ao problema apresentado?"],
  ["Benefício para o público", "A equipe demonstra como a solução poderá ajudar as pessoas?"],
  ["Aplicação da tecnologia", "As ferramentas utilizadas contribuem para o funcionamento da proposta?"],
  ["Protótipo", "A equipe consegue demonstrar ou representar a solução?"],
  ["Viabilidade", "A proposta considera recursos, limites e próximos passos?"],
  ["Comunicação", "O pitch apresenta a ideia com clareza?"],
  ["Colaboração e aprendizagem", "Os integrantes conseguem explicar suas contribuições e seus aprendizados?"],
].map(([name, description]) => ({ eventId: event.id, name, description, weight: 1, maxScore: 10 })));

await db.insert(schema.resources).values([
  { eventId: event.id, title: "Roteiro do pitch", url: "https://example.com/roteiro-pitch", description: "Como organizar sua apresentação em 3 minutos." },
]);
await db.insert(schema.announcements).values({ eventId: event.id, createdBy: admin.id, title: "Bem-vindos!", body: "Crie sua equipe e acompanhe prazos e orientações por aqui." });

console.log(`Seed concluído. Organização: ${env.SEED_ADMIN_EMAIL}`);
await pool.end();
