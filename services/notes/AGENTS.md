# AGENTS.md — notes service

Work from `services/notes/` only. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/notes`

## Purpose

Obsidian-like notes for Hone Electron:

- Markdown notes with folders (CRUD + move)
- E2EE vault: server stores salt + ciphertext only (client PBKDF2 200k + AES-256-GCM)
- Publish / share-to-web / make-private flows

## Ports

HTTP `8090` | gRPC `9100` | PG `5442` / `druzya_notes`

## HTTP (grpc-gateway)

| Area | Paths |
|------|-------|
| Vault | `POST /v1/notes/vault/init`, `GET /v1/notes/vault/salt`, `POST /v1/notes/vault/notes/{id}/encrypt`, `POST /v1/notes/vault/notes/{id}/decrypt` |
| Notes | `GET/POST /v1/notes`, `GET/PUT/DELETE /v1/notes/{id}`, `POST /v1/notes/{id}/move`, `GET /v1/notes/meta` |
| Folders | `GET/POST /v1/notes/folders`, `DELETE /v1/notes/folders/{id}` |
| Publish | `POST /v1/notes/{id}/publish`, `unpublish`, `share-to-web`, `make-private`, `GET publish-status` |

## Env

| Var | Default (dev) |
|-----|---------------|
| `HTTP_PORT` | `8090` |
| `GRPC_PORT` | `9100` |
| `POSTGRES_DSN` | `postgres://postgres:postgres@localhost:5442/druzya_notes?sslmode=disable` |
| `JWT_PUBLIC_KEY` or `JWT_PUBLIC_KEY_FILE` | required |
| `BILLING_GRPC_ADDR` | optional; default `127.0.0.1:9095` |
| `INTERNAL_API_TOKEN` | optional; enables `cloud_notes_count` gate on create |
| `PUBLIC_BASE_URL` / `FRONTEND_URL` | publish link base (default `http://localhost:5173`) |

## Billing

When `INTERNAL_API_TOKEN` is set, `CreateNote` checks active note count against billing gauge `cloud_notes_count` (free: 10, pro: unlimited). Exceed → gRPC `ResourceExhausted`.

## Data model

- `vault_salts` — per-user random 32-byte salt (base64 to client)
- `note_folders` — tree via `parent_id`
- `notes` — `body_md` plaintext or ciphertext; `encrypted`, `published`, `publish_slug`

Soft-delete: `archived_at` set on delete.

## Commands

```bash
cd services/notes
make start | gen-proto | test | lint | build
```

Build: `GOWORK=off`

Hone client: `apps/hone/src/renderer/src/api/notesClient.ts`, vault paths in `api/vault.ts`.
