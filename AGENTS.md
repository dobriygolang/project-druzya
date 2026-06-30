# AGENTS.md — project-druzya (monorepo index)

This repo groups independent services under `services/<name>/`.

**Do not use a root Makefile** — each service is self-contained.

When working on a service, **open only that service folder** and read its local `AGENTS.md`.

| Service | AGENTS.md | Reference for |
|---------|-----------|---------------|
| **template** | [services/template/AGENTS.md](services/template/AGENTS.md) | **copy skeleton** for new services |
| identity | [services/identity/AGENTS.md](services/identity/AGENTS.md) | auth, Redis, interceptors, custom HTTP |
| billing | [services/billing/AGENTS.md](services/billing/AGENTS.md) | usage quotas, Tribute billing |
| sandbox | [services/sandbox/AGENTS.md](services/sandbox/AGENTS.md) | code execution + LSP (live rooms) |
| **rooms** | [services/rooms/AGENTS.md](services/rooms/AGENTS.md) | live coding collab, WS + Yjs |
| **tracker** | [services/tracker/AGENTS.md](services/tracker/AGENTS.md) | task board, sprint/epic, Google Calendar |
| **notes** | [services/notes/AGENTS.md](services/notes/AGENTS.md) | notes, E2EE vault, publish-to-web |
| **focus** | [services/focus/AGENTS.md](services/focus/AGENTS.md) | pomodoro sessions, focus stats |
| ai | [services/ai/AGENTS.md](services/ai/AGENTS.md) | **ARCHIVED — CI only, not prod** |

**Desktop app:** [apps/hone/AGENTS.md](apps/hone/AGENTS.md) — Tauri focus workspace (notes, tasks, whiteboard, sync).

**Web companion:** [apps/web/AGENTS.md](apps/web/AGENTS.md) — landing, guest live collab, pricing, published notes/boards.

**Retired (removed):** content, interview, recommendation, admin — see [docs/onboarding/README.md](docs/onboarding/README.md#retired-services).

Prod deploy: [deploy/PRODUCTION_CHECKLIST.md](deploy/PRODUCTION_CHECKLIST.md), [deploy/RUNBOOK.md](deploy/RUNBOOK.md)

Future outbox relay design: [docs/architecture/outbox-relay.md](docs/architecture/outbox-relay.md)

Root `go.work` is optional. Services build with `GOWORK=off`.

---

## Service template (canonical)

Pattern from **identity** + **template**. **Start new services by copying `services/template/`.**

> **Target architecture (CQRS + DDD + Clean Architecture):** see
> [.cursor/rules/architecture-standard.mdc](.cursor/rules/architecture-standard.mdc).
> Per domain add `usecase/{command,query}/<op>/` packages (each = `command|query.go`
> with `Validate()` + `handler.go` with `New`/`Handle` + `mocks/`) and a `repository/store.go`
> port. Reference exemplars: `services/template/internal/example/usecase/query/get_item/`
> (read) and `services/template/internal/example/usecase/command/` (write — add when extracting commands).
> The directory tree below is the minimal skeleton; grow it toward the standard as a service matures.

### Directory tree

```
services/<name>/
├── AGENTS.md
├── Makefile
├── go.mod
├── .golangci.yml
├── buf.yaml
├── buf.gen.yaml
├── .gitignore                  # .bin/, pkg/api/
├── cmd/
│   └── <name>/
│       ├── main.go
│       └── app/
│           ├── run.go            # DI only
│           └── server.go         # HTTP + gRPC startup
├── api/
│   ├── google/api/               # vendored annotations (copy from template)
│   └── <name>/v1/
│       └── <name>.proto
├── pkg/
│   ├── api/                      # generated — gitignored
│   └── client/                   # port for other services (= domain Service)
├── internal/
│   ├── <domain>/                 # one or more bounded contexts
│   │   ├── model/
│   │   ├── repository/           # concrete postgres/redis
│   │   └── service/              # Service interface + impl
│   ├── adapter/<vendor>/         # external APIs only (OAuth, …)
│   ├── app/api/<name>/           # transport — see below
│   ├── config/
│   └── tools/                    # logger, humanerror
├── scripts/
│   ├── migrations/               # goose SQL
│   └── dev/docker-compose.yml
└── .cursor/rules/
    ├── service.mdc
    └── go-backend.mdc
```

### Transport layer (`internal/app/api/<name>/`)

| File | Role |
|------|------|
| `service.go` | `Implementation` struct + `NewImplementation(svc domain.Service)` |
| `register.go` | gRPC registration, `NewRegisteredImplementation` |
| `gateway.go` | grpc-gateway mux, `HealthzHTTP`, `RegisterGateway` |
| `errors.go` | gRPC status helpers (`invalidArgument`, `notFound`, …) |
| `mapper.go` | proto ↔ domain mapping, `mapServiceError` |
| `<rpc_name>.go` | **One RPC per file** (`get_item.go`, `list_items.go`, …) |

Custom HTTP routes (OAuth callback, file download): add `*_http.go` on `Implementation` — see identity `yandex_callback_http.go`.

### Layer rules

```
transport → domain service (interface) → repository → postgres/redis
                                              ↑
                                    adapter/ — 3rd-party APIs only
```

| Layer | Responsibility |
|-------|----------------|
| **Transport** | Validate request, call domain `Service`, map errors to gRPC |
| **Service** | `Service` interface + unexported struct; business logic; `New(Deps) Service` |
| **Repository** | Concrete SQL/Redis; `ErrNotFound`; no interface-only package |
| **Model** | Plain structs, no DB/HTTP imports |
| **DI** | `cmd/<name>/app/run.go` wires everything |

### Domain service pattern

```go
// internal/<domain>/service/service.go
type Service interface {
    GetItem(ctx context.Context, id, slug string) (*model.Item, error)
}

type itemService struct { repo *repository.Repository }

func New(deps Deps) Service { return &itemService{repo: deps.Repo} }
```

Transport receives `domain.Service`, not a duplicate transport interface:

```go
// internal/app/api/<name>/register.go
func NewRegisteredImplementation(s *grpc.Server, svc exampleservice.Service) *Implementation
```

### Port allocation (defaults)

| Service | HTTP | gRPC | Postgres port | DB name |
|---------|------|------|---------------|---------|
| identity | 8080 | 9090 | 5432 | druzya |
| ai | 8083 | 9093 | 5435 | druzya_ai |
| billing | 8085 | 9095 | 5438 | druzya_billing |
| sandbox | 8086 | 9096 | 5439 | druzya_sandbox |
| **rooms** | **8087** | **9097** | **5440** | **druzya_rooms** |
| **tracker** | **8089** | **9099** | **5441** | **druzya_tracker** |
| **notes** | **8090** | **9100** | **5442** | **druzya_notes** |
| **focus** | **8091** | **9101** | **5443** | **druzya_focus** |
| template | 8099 | 9199 | 5439 | druzya_template |

Pick unused ports for each new service. Update `Makefile`, `config.go`, `docker-compose.yml`.

### Do / Don't

| Do | Don't |
|----|-------|
| Copy `services/template/` | Start from empty folder |
| One handler file per RPC | `handlers.go` with all RPCs |
| Domain `Service` interface | Duplicate interface in transport |
| `errors.go` for gRPC codes | Error helpers in `gateway.go` |
| Vendored `api/google/api/` | buf remote deps behind corporate proxy |
| `make gen-proto` → `.bin/` | buf in go.mod |
| `GOPROXY=https://proxy.golang.org,direct go mod tidy` | Ignore go.sum proxy errors |

### Proto & API

- gRPC + HTTP in one proto via `google.api.http`.
- Internal-only RPCs: omit HTTP annotation.
- `additional_bindings` for slug lookups: `/v1/items/by-slug/{slug}`.
- Generated code in `pkg/api/` — never edit.

### Standard Makefile targets

```bash
make help | start | run | build | test | lint | gen-proto
make migrate-new NAME=<snake> | migrate-up | migrate-down | stop
```

### New service checklist

Follow [services/template/AGENTS.md](services/template/AGENTS.md#copy-as-new-service): copy template, rename, pick ports, `make migrate-new NAME=init`, `make gen-proto && make lint && make build`, document in `AGENTS.md`.

**Registry (CI/deploy):** edit [deploy/scripts/services.conf.sh](deploy/scripts/services.conf.sh), sync `.github/workflows/ci.yml` matrix + `go.work`, run `bash deploy/scripts/verify-service-registry.sh`. Full list: [.cursor/rules/service-registry.mdc](.cursor/rules/service-registry.mdc).

### Go proxy

Corporate proxy stale cache: `GOPROXY=https://proxy.golang.org,direct go mod tidy`

### Documentation

Each `services/<name>/AGENTS.md` = source of truth for that service. Cross-service flows: [docs/onboarding/README.md](docs/onboarding/README.md). Update docs in the same PR as code — see [.cursor/rules/agents-md.mdc](.cursor/rules/agents-md.mdc).
