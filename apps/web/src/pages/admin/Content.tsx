import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/utils";
import Crud from "./Crud";

export const AdminProblems = () => (
  <Crud title="Problemas" subtitle="Descreva o problema sem direcionar todos para uma única solução." noun="problema" path="problems"
    defaults={{ published: true }}
    columns={[{ key: "title", label: "Título" }, { key: "published", label: "Situação", render: (r) => <Badge tone={r.published ? "success" : "neutral"}>{r.published ? "Publicado" : "Rascunho"}</Badge> }]}
    fields={[
      { key: "title", label: "Título", type: "text", required: true }, { key: "question", label: "Pergunta que orienta o desafio", type: "text" },
      { key: "context", label: "Contexto e descrição", type: "textarea" }, { key: "affected", label: "Pessoas ou grupos afetados", type: "textarea" },
      { key: "references", label: "Informações e referências", type: "textarea" }, { key: "constraints", label: "Limites e condições", type: "textarea" },
      { key: "resources", label: "Recursos que podem ser usados", type: "textarea" }, { key: "deliverables", label: "Entregas esperadas", type: "textarea" },
      { key: "criteria", label: "Critérios de avaliação", type: "textarea" }, { key: "published", label: "Publicado", type: "checkbox" },
    ]} />
);

export const AdminActivities = () => (
  <Crud title="Atividades e prazos" subtitle="Horários exatos e obrigatoriedade são configuráveis." noun="atividade" fem path="activities"
    defaults={{ kind: "activity", required: true, allowText: true, allowLinks: true, acceptedFormats: [], maxFiles: 3, position: 0 }}
    columns={[
      { key: "title", label: "Atividade" }, { key: "dueAt", label: "Prazo", render: (r) => fmtDateTime(r.dueAt) },
      { key: "kind", label: "Tipo", render: (r) => ({ activity: "Atividade", final: "Entrega final", reflection: "Reflexão" })[r.kind as string] },
      { key: "required", label: "Obrigatória", render: (r) => (r.required ? "Sim" : "Não") },
    ]}
    fields={[
      { key: "title", label: "Título", type: "text", required: true }, { key: "objective", label: "Objetivo", type: "textarea" }, { key: "instructions", label: "Instruções curtas", type: "textarea" },
      { key: "kind", label: "Tipo", type: "select", options: [["activity", "Atividade"], ["final", "Entrega final"], ["reflection", "Reflexão"]] },
      { key: "dueAt", label: "Prazo", type: "datetime", required: true }, { key: "required", label: "Obrigatória", type: "checkbox" },
      { key: "allowText", label: "Aceita resposta em texto", type: "checkbox" }, { key: "allowLinks", label: "Aceita links", type: "checkbox" },
      { key: "acceptedFormats", label: "Formatos de arquivo aceitos", type: "formats", hint: "Vazio = todos os formatos permitidos." },
      { key: "maxFiles", label: "Máximo de anexos (0 = sem arquivos)", type: "number" }, { key: "position", label: "Ordem", type: "number" },
    ]} />
);

export const AdminAnnouncements = () => (
  <Crud title="Avisos" subtitle="Mudanças na programação, lembretes e orientações." noun="aviso" path="announcements" defaults={{}}
    columns={[{ key: "title", label: "Título" }, { key: "createdAt", label: "Publicado em", render: (r) => fmtDateTime(r.createdAt) }]}
    fields={[{ key: "title", label: "Título", type: "text", required: true }, { key: "body", label: "Mensagem", type: "textarea", required: true }]} />
);

export const AdminResources = () => (
  <Crud title="Materiais de apoio" subtitle="Regulamento, roteiro do pitch, modelo de apresentação, tutorial de envio…" noun="material" path="resources" defaults={{}}
    columns={[{ key: "title", label: "Título" }, { key: "url", label: "Link" }]}
    fields={[{ key: "title", label: "Título", type: "text", required: true }, { key: "url", label: "Link (https://)", type: "text", required: true }, { key: "description", label: "Descrição", type: "text" }]} />
);

export const AdminCriteria = () => (
  <Crud title="Critérios de avaliação" subtitle="Escalas e pesos devem ser divulgados antes da avaliação." noun="critério" path="criteria" defaults={{ weight: 1, maxScore: 10 }}
    columns={[{ key: "name", label: "Critério" }, { key: "weight", label: "Peso" }, { key: "maxScore", label: "Nota máxima" }]}
    fields={[{ key: "name", label: "Nome", type: "text", required: true }, { key: "description", label: "O que observar", type: "textarea" }, { key: "weight", label: "Peso", type: "number" }, { key: "maxScore", label: "Nota máxima", type: "number" }]} />
);
