# AGENTS.md — project-druzya (monorepo index)

This repo groups independent services under `services/<name>/`.

**Do not use a root Makefile** — each service is self-contained.

When working on a service, **open only that service folder** and read its local `AGENTS.md`.

| Service | AGENTS.md | Reference for |
|---------|-----------|---------------|
| **template** | [services/template/AGENTS.md](services/template/AGENTS.md) | **copy skeleton** for new services |
| identity | [services/identity/AGENTS.md](services/identity/AGENTS.md) | auth, Redis, interceptors, custom HTTP |
| content | [services/content/AGENTS.md](services/content/AGENTS.md) | catalog domain, many read RPCs |
| interview | [services/interview/AGENTS.md](services/interview/AGENTS.md) | |
| ai | [services/ai/AGENTS.md](services/ai/AGENTS.md) | |
| sandbox | [services/sandbox/AGENTS.md](services/sandbox/AGENTS.md) | |
| billing | [services/billing/AGENTS.md](services/billing/AGENTS.md) | |

Root `go.work` is optional. Services build with `GOWORK=off`.

---

## Service template (canonical)

Pattern from **search-performance** + **identity** + **content**. **Start new services by copying `services/template/`.**

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
| content | 8081 | 9091 | 5433 | druzya_content |
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

1. `cp -R services/template services/<name>` — follow [services/template/AGENTS.md](services/template/AGENTS.md#copy-as-new-service).
2. Rename module, paths, ports, DB name.
3. Replace `internal/example/` with your domain; update proto + handlers.
4. `make migrate-new NAME=init` — write schema (or edit copied migration).
5. `make gen-proto && make tidy && make lint && make build`.
6. Document domain in `services/<name>/AGENTS.md`.

### Go proxy

```bash
cd services/<name>
GOPROXY=https://proxy.golang.org,direct go mod tidy
```

### Code policy

- English code, logs, comments; `%w` wrapped errors
- Minimal diffs
- User commits manually unless asked
