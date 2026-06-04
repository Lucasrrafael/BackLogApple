# Guitarllito — Backlog de Cards

Organizador de cards em formato kanban/backlog para o projeto **Guitarllito**, app iOS desenvolvido no **Apple Developer Academy** (Challenge 4 — Matriz Cinema).

O time usa esta página para acompanhar as features do app: o que é fácil, médio ou difícil, o que já foi concluído e o que ainda falta implementar em SwiftUI (iOS 15 / Xcode 13.2.1).

**Demo:** [back-log-apple.vercel.app](https://back-log-apple.vercel.app)

---

## O que faz

- **Cards por dificuldade** — Fácil, Médio e Difícil, com descrição e guia de implementação Swift
- **Marcar concluído** — status compartilhado entre o time (salvo no banco)
- **Criar e apagar cards** — adicionar tarefas novas ou remover as que não fizerem mais sentido
- **Filtros e progresso** — filtrar por nível, ocultar concluídas e ver barra de progresso geral
- **Sincronização** — polling a cada ~8s para ver mudanças do colega sem dar F5

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | HTML, CSS, JavaScript (módulos ES) |
| Backend | Vercel Serverless Functions (`/api/tasks`, `/api/done`) |
| Banco | Neon Postgres (integração Vercel) |
| Deploy | Vercel |

---

## Estrutura do repositório

```
├── index.html          # Página principal
├── css/backlog.css     # Estilos
├── js/
│   ├── api.js          # Chamadas à API
│   └── backlog.js      # UI, filtros, polling, CRUD
├── api/
│   ├── tasks.js        # CRUD de cards
│   ├── done.js         # Status concluído
│   └── seed.js         # Seed inicial (protegido por senha)
├── data/tasks.json     # 45 cards extraídos do backlog original
├── sql/schema.sql      # Schema Postgres
└── scripts/seed-from-html.js
```

---

## Uso no dia a dia

1. Abra o link do deploy.
2. Navegue pelos cards e use os filtros **Todos / Fácil / Médio / Difícil**.
3. Na **primeira alteração** (concluir, criar ou apagar), informe a **senha do time** quando o modal aparecer.
4. Compartilhe a mesma senha com quem estiver no projeto.

Leitura é pública; escrita exige a senha configurada em `BACKLOG_SECRET` na Vercel.

---

## Deploy (resumo)

1. Importar o repo na [Vercel](https://vercel.com) (preset **Other**).
2. Criar banco **Neon** em Storage e vincular ao projeto (prefixo `POSTGRES`).
3. Adicionar `BACKLOG_SECRET` em Environment Variables.
4. Rodar o seed uma vez (local com `vercel env run` ou `POST /api/seed` com a senha).

---

## Contexto do projeto iOS

Backlog das features do app **Guitarllito** — metas de prática de guitarra, sessões, XP, badges, gravações, widget, integração Gemini, etc. Cada card (ex.: `MC-021`) mapeia uma entrega do challenge e inclui sub-tarefas e notas de implementação para iOS 15.

---

## Licença

Projeto acadêmico — Apple Developer Academy.
