# AGENTS.md — template service (skeleton)

**Not production.** Copy to bootstrap new services. Monorepo: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/template`

## Copy as new service

```bash
NEW=myservice
cp -R services/template "services/${NEW}"
# sed template→NEW, druzya_template→druzya_${NEW} in go/proto/make files
# mv cmd/template, api/template, internal/app/api/template
# rename internal/example → your domain
cd "services/${NEW}" && make gen-proto && make tidy && make lint && make build
```

On Linux: `sed -i` without `''`. Pick unique ports — [root AGENTS.md port table](../../AGENTS.md#port-allocation-defaults).

## Layout

See [.cursor/rules/architecture-standard.mdc](../../.cursor/rules/architecture-standard.mdc). Exemplars:

- Read: `internal/example/usecase/query/get_item/`
- Write: `services/interview/.../usecase/command/submit_attempt/`

## Example API

| RPC | HTTP |
|-----|------|
| Ping | `GET /v1/ping` |
| ListItems, GetItem | `GET /v1/items` |

## Ports

HTTP `8099` | gRPC `9199` | PG `5439` / `druzya_template`

## Commands

```bash
cd services/template
make start | gen-proto | lint | build
```

Reference services: **content** (catalog RPCs), **identity** (auth, Redis, custom HTTP).
