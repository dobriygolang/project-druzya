# AGENTS.md — project-druzya (monorepo index)

This repo groups independent services under `services/<name>/`.

**Do not use a root Makefile** — each service is self-contained.

When working on a service, **open only that service folder** (e.g. `services/identity/`) and read its local `AGENTS.md` for domain-specific details.

| Service | AGENTS.md | Reference for |
|---------|-----------|---------------|
| identity | [services/identity/AGENTS.md](services/identity/AGENTS.md) | **canonical layout**, auth, gRPC+HTTP |
| content | [services/content/AGENTS.md](services/content/AGENTS.md) | |
| interview | [services/interview/AGENTS.md](services/interview/AGENTS.md) | |
| ai | [services/ai/AGENTS.md](services/ai/AGENTS.md) | |
| sandbox | [services/sandbox/AGENTS.md](services/sandbox/AGENTS.md) | |
| billing | [services/billing/AGENTS.md](services/billing/AGENTS.md) | |

Root `go.work` is optional convenience for multi-module IDE sessions. Services build with `GOWORK=off` and do not depend on monorepo root files.

---

## Service template (canonical)

Pattern aligned with **search-performance** domain layout. **Reference implementation:** `services/identity/`.

Use this when creating or refactoring any service — do not invent a new folder scheme.

### Directory tree

```
services/<name>/
├── AGENTS.md
├── Makefile
├── go.mod
├── .golangci.yml
├── buf.yaml
├── buf.gen.yaml
├── cmd/
│   └── <name>/
│       ├── main.go
│       └── app/
│           ├── run.go          # DI: wire repos, services, adapters
│           └── server.go       # HTTP + gRPC startup
├── api/
│   ├── google/api/             # vendored google.api.http annotations
│   └── <name>/v1/
│       └── <name>.proto        # gRPC + HTTP (grpc-gateway) contract
├── pkg/
│   └── api/                    # generated — gitignored, make gen-proto
├── internal/
│   ├── <domain>/               # one folder per bounded context
│   │   ├── model/              # entities, value objects
│   │   ├── repository/         # persistence impl (postgres/redis/…)
│   │   └── service/            # business logic
│   ├── adapter/                # external clients only (OAuth, 3rd-party APIs)
│   │   └── <vendor>/
│   ├── app/api/<name>/         # gRPC/HTTP transport (thin handlers)
│   ├── config/
│   └── tools/                  # logger, humanerror, shared helpers
├── scripts/
│   ├── migrations/             # goose SQL
│   └── dev/
│       └── docker-compose.yml
└── .cursor/rules/
    ├── service.mdc
    └── go-backend.mdc
```

`<domain>` = bounded context name (`user`, `auth`, `campaign`, `content`, …). A service may have **one or several** domain folders under `internal/`.

### Layer rules

```
transport (internal/app/api/) → service (internal/<domain>/service/) → repository (internal/<domain>/repository/)
                                                                                    ↑
                                                              adapter (internal/adapter/) — external APIs only
```

| Layer | Path | Responsibility |
|-------|------|----------------|
| **Transport** | `internal/app/api/<name>/` | Proto ↔ service mapping, auth interceptor, grpc-gateway, custom HTTP handlers. **One RPC per file** (`get_foo.go`, `create_bar.go`). |
| **Service** | `internal/<domain>/service/` | Business logic, orchestration, domain errors. Defines `Service` interface + `New(Deps)`. |
| **Repository** | `internal/<domain>/repository/` | **Concrete** persistence (SQL, Redis). `Repository` struct + `New(...)`. No separate interface-only package. |
| **Model** | `internal/<domain>/model/` | Domain types — no DB/HTTP imports. |
| **Adapter** | `internal/adapter/<vendor>/` | Third-party HTTP/gRPC clients (Yandex OAuth, payment gateway, …). Not for postgres/redis. |
| **DI** | `cmd/<name>/app/run.go` | **Only place** that wires repos, adapters, services. |

### Do / Don't

| Do | Don't |
|----|-------|
| `internal/user/repository/repository.go` with postgres impl | `internal/user/repository/user.go` (interface) + `internal/adapter/postgres/` |
| Split transport: one handler file per RPC | Monolithic `handlers.go` with all RPCs |
| `google.api.http` annotations in proto → grpc-gateway | Separate REST handlers duplicating proto |
| Vendored `api/google/api/` for offline buf | `buf.build` deps when corporate proxy blocks |
| Proto tools via `make gen-proto` → `.bin/` (pinned `@version`) | `go get buf` polluting `go.mod` |
| `GOPROXY=https://proxy.golang.org,direct go mod tidy` on checksum errors | Ignore `go.sum` mismatch from corporate proxy |

### Proto & API

- One proto service per API surface; HTTP paths via `option (google.api.http)`.
- Browser redirects / file downloads: custom HTTP handler on `Implementation` (see identity `yandex_callback_http.go`).
- Internal-only RPCs: no `google.api.http` annotation.
- Generated code lives in `pkg/api/` — never edit by hand.

### Standard Makefile targets

Every service should expose (ports vary):

```bash
make help
make start          # docker deps + migrate + run
make run
make build
make test
make lint           # golangci-lint + buf + go.mod drift
make gen-proto
make migrate-new NAME=<snake_name>
make migrate-up
make stop
```

### New service checklist

1. Copy skeleton from `services/identity/` (strip domain-specific auth/bot).
2. Rename module → `github.com/sedorofeevd/project-druzya/services/<name>`.
3. Define domain folder(s) under `internal/<domain>/`.
4. Write proto in `api/<name>/v1/` with HTTP annotations.
5. `make gen-proto` → implement transport handlers.
6. `make migrate-new NAME=init` → implement repository.
7. Wire DI in `cmd/<name>/app/run.go`.
8. Document entities, API, env in `services/<name>/AGENTS.md`.
9. Verify: `make gen-proto && make lint && make test`.

### Go proxy

`goproxy.s.o3.ru: Forbidden` or `checksum mismatch` — not a code bug:

```bash
cd services/<name>
GOPROXY=https://proxy.golang.org,direct go mod tidy
```

### Code policy (all services)

- English code, logs, comments; wrapped errors lowercase with `%w`
- Minimal diffs; no AI mentions in commits
- User commits manually unless explicitly asked
