# AGENTS.md — content service

**Self-contained service.** Work from this directory only.

Monorepo template: [../../AGENTS.md](../../AGENTS.md#service-template-canonical).

Module: `github.com/sedorofeevd/project-druzya/services/content`

## Purpose

Read-only **catalog** — what the user *can* pass: companies, interview templates, tasks, reference solutions, rubrics.

Out of scope: user answers, attempts, scores, progress, retry queue, AI results (interview/ai services).

## Ports

| Protocol | Default |
|----------|---------|
| HTTP     | 8081    |
| gRPC     | 9091    |
| Postgres | 5433 (`druzya_content`) |

## Layout

```
cmd/content/
api/content/v1/
pkg/api/content/v1/           — generated (make gen-proto)
pkg/client/                   — ContentClient (= catalogservice.Service)
internal/catalog/
  model/                      — all catalog entities
  repository/                 — postgres
  service/                    — Service interface + use cases
internal/app/api/content/     — gRPC/HTTP transport (one RPC per file)
internal/config/
internal/tools/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Layer rules

```
transport (internal/app/api/content/) → catalog/service → catalog/repository
```

Other services use `pkg/client.ContentClient` or gRPC — never read content tables directly.

## Schema

| Table | Notes |
|-------|-------|
| `companies` | Preparation profiles / employer tracks |
| `interview_templates` | Interview blueprints |
| `template_sections` | Ordered sections |
| `template_section_tasks` | Section → task links with `position` |
| `tasks` | Task definitions; `metadata JSONB` per type |
| `task_solutions` | Reference solutions |
| `rubrics` + `rubric_criteria` | Scoring rubrics by `task_type` |
| `articles` + `article_skill_keys` + `article_videos` + `article_tasks` | Knowledge-base articles; videos; linked catalog tasks |

Rubrics resolve by active rubric for `task.type` (no per-task override table).

## Key use cases

**GetInterviewTemplateDetail** — template + sections + `task_ids` per section (for interview-service).

**GetTaskBundle** — task + solutions + rubric/criteria (for ai-service).

## API

| RPC | HTTP |
|-----|------|
| ListCompanies | `GET /v1/companies` |
| GetCompany | `GET /v1/companies/{id}` or `/by-slug/{slug}` |
| ListInterviewTemplates | `GET /v1/interview-templates` |
| GetInterviewTemplateDetail | `GET /v1/interview-templates/{id}/detail` or `/by-slug/{slug}/detail` |
| ListTasks | `GET /v1/tasks` (default `status=published`) |
| GetTask | `GET /v1/tasks/{id}` or `/by-slug/{slug}` |
| GetTaskBundle | `GET /v1/tasks/{task_id}/bundle` |
| GetRubric | `GET /v1/rubrics/{id}` |
| ListArticles | `GET /v1/articles` (`query`, `skill_key`) |
| GetArticle | `GET /v1/articles/{id}` or `/by-slug/{slug}` — includes `linked_tasks`, `related_articles` |

Admin writes (gRPC `ContentAdminService`, `x-admin-token`): UpsertArticle, GetArticleForAdmin, …

## Commands

```bash
cd services/content
make start
make gen-proto
make lint
make test
make build
```

## Env

| Variable | Default |
|----------|---------|
| HTTP_PORT | 8081 |
| GRPC_PORT | 9091 |
| POSTGRES_DSN | `postgres://postgres:postgres@localhost:5433/druzya_content?sslmode=disable` |
| LOG_LEVEL | info |
