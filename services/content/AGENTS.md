# AGENTS.md — content service

Work from this directory only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/content`

## Purpose

Read-only **catalog** — companies, templates, tasks, solutions, rubrics, articles.

Out of scope: attempts, scores, progress (interview/ai/recommendation).

## Ports

HTTP `8081` | gRPC `9091` | Postgres `5433` / `druzya_content`

## Schema

| Table | Notes |
|-------|-------|
| `companies`, `interview_templates`, `template_sections`, `template_section_tasks` | Interview blueprints |
| `tasks` | `metadata JSONB` per type (see below) |
| `task_solutions`, `rubrics`, `rubric_criteria` | Reference solutions + scoring |
| `articles`, `article_skill_keys`, `article_videos`, `article_tasks` | Knowledge base |

### Task metadata

| Field | When |
|-------|------|
| `execution`: `"sandbox"` | Runnable tasks with `examples` / `test_cases` |
| `execution`: `"none"` | Behavioral, system design — AI only |
| `editor_preset.{lang}.solution` / `.harness` | Solo editor + sandbox I/O |
| `prompt` / `hints` | UI or eval context |

Seed: `scripts/migrations/00002_seed.sql`. Rubrics resolve by active rubric for `task.type`.

## Key RPCs

- **GetInterviewTemplateDetail** — template + sections + task ids (interview)
- **GetTaskBundle** — task + solutions + rubric (ai)

## API

| RPC | HTTP |
|-----|------|
| ListCompanies, GetCompany | `/v1/companies` |
| ListInterviewTemplates, GetInterviewTemplateDetail | `/v1/interview-templates` |
| ListTasks, GetTask, GetTaskBundle | `/v1/tasks`, `/v1/tasks/{id}/bundle` |
| GetRubric | `/v1/rubrics/{id}` |
| ListArticles, GetArticle | `/v1/articles` |

Admin writes: gRPC `ContentAdminService` (`x-admin-token`) — UpsertTask, UpsertArticle, …

## Catalog cache

Full snapshot in RAM on startup (`internal/catalog/cache/`). Admin writes reload it. Metrics: `content_catalog_*`.

## Commands

```bash
cd services/content
make start | gen-proto | lint | test | build
```
