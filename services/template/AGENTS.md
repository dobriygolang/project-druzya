# AGENTS.md — template service (skeleton)

**Not a production service.** Copy this folder when bootstrapping a new microservice.

Monorepo index: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/template`

## Purpose

Minimal working gRPC + HTTP (grpc-gateway) + Postgres service demonstrating the canonical layout. Replace `example` domain with your own.

## Copy as new service

```bash
# from repo root
NEW=myservice
cp -R services/template "services/${NEW}"

# rename (review diff before committing)
find "services/${NEW}" -type f \( -name '*.go' -o -name '*.proto' -o -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name 'Makefile' -o -name 'go.mod' \) \
  -exec sed -i '' "s/template/${NEW}/g" {} +
find "services/${NEW}" -type f \( -name '*.go' -o -name '*.proto' -o -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name 'Makefile' -o -name 'go.mod' \) \
  -exec sed -i '' "s/druzya_template/druzya_${NEW}/g" {} +

# pick unique ports in Makefile + config + docker-compose (see port table in root AGENTS.md)
mv "services/${NEW}/cmd/template" "services/${NEW}/cmd/${NEW}"
mv "services/${NEW}/api/template" "services/${NEW}/api/${NEW}"
mv "services/${NEW}/internal/app/api/template" "services/${NEW}/internal/app/api/${NEW}"

# rename internal/example → internal/<your-domain>
# update imports, proto package, Makefile SERVICE:=

cd "services/${NEW}"
make gen-proto && make tidy && make lint && make build
```

On Linux drop `''` after `-i` in `sed`.

## Layout (canonical — target CQRS/DDD shape)

```
cmd/template/
api/template/v1/template.proto
pkg/api/                    — generated
pkg/client/
internal/example/           — rename to your bounded context
  model/                    — entities + errors.go (domain sentinels)
  repository/               — Postgres + store.go (Store port, satisfied by Repository)
  service/                  — thin Service: simple reads inline, rich ops delegate to usecase
  usecase/
    query/get_item/         — Query+Validate, Handler(New+Handle), mocks/  (READ exemplar)
    command/<op>/           — Command+Validate, Handler(New+Handle), mocks/ (WRITE pattern)
internal/app/api/template/  — transport, one RPC per file, proto<->domain + error mapping
internal/config/
internal/tools/
scripts/migrations/
scripts/dev/docker-compose.yml
```

See `.cursor/rules/architecture-standard.mdc` for the full standard. The
`get_item` query here and `services/interview/.../usecase/command/submit_attempt/`
are the copy-paste exemplars for new read/write operations.

## Example API

| RPC | HTTP |
|-----|------|
| Ping | `GET /v1/ping` |
| ListItems | `GET /v1/items` |
| GetItem | `GET /v1/items/{id}` or `/by-slug/{slug}` |

## Ports (template defaults — change when copying)

| Protocol | Value |
|----------|-------|
| HTTP | 8099 |
| gRPC | 9199 |
| Postgres | 5439 / `druzya_template` |

## Commands

```bash
cd services/template
make start
make gen-proto
make lint
make build
```

## References

| Service | Use for |
|---------|---------|
| **template** | Copy skeleton, minimal CRUD |
| **content** | Single-domain catalog, many RPCs |
| **identity** | Auth, Redis, custom HTTP handlers, interceptors |
