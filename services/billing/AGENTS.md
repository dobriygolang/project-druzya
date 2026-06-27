# AGENTS.md — billing service (skeleton)

**Not a production service.** Copy this folder when bootstrapping a new microservice.

Monorepo index: [../../AGENTS.md](../../AGENTS.md).

Module: `github.com/sedorofeevd/project-druzya/services/billing`

## Purpose

Minimal working gRPC + HTTP (grpc-gateway) + Postgres service demonstrating the canonical layout. Replace `example` domain with your own.

## Copy as new service

```bash
# from repo root
NEW=myservice
cp -R services/billing "services/${NEW}"

# rename (review diff before committing)
find "services/${NEW}" -type f \( -name '*.go' -o -name '*.proto' -o -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name 'Makefile' -o -name 'go.mod' \) \
  -exec sed -i '' "s/billing/${NEW}/g" {} +
find "services/${NEW}" -type f \( -name '*.go' -o -name '*.proto' -o -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name 'Makefile' -o -name 'go.mod' \) \
  -exec sed -i '' "s/druzya_billing/druzya_${NEW}/g" {} +

# pick unique ports in Makefile + config + docker-compose (see port table in root AGENTS.md)
mv "services/${NEW}/cmd/billing" "services/${NEW}/cmd/${NEW}"
mv "services/${NEW}/api/billing" "services/${NEW}/api/${NEW}"
mv "services/${NEW}/internal/app/api/billing" "services/${NEW}/internal/app/api/${NEW}"

# rename internal/example → internal/<your-domain>
# update imports, proto package, Makefile SERVICE:=

cd "services/${NEW}"
make gen-proto && make tidy && make lint && make build
```

On Linux drop `''` after `-i` in `sed`.

## Layout (canonical)

```
cmd/billing/
api/billing/v1/billing.proto
pkg/api/                    — generated
pkg/client/
internal/example/           — rename to your bounded context
  model/
  repository/
  service/                  — Service interface
internal/app/api/billing/  — transport, one RPC per file
internal/config/
internal/tools/
scripts/migrations/
scripts/dev/docker-compose.yml
```

## Example API

| RPC | HTTP |
|-----|------|
| Ping | `GET /v1/ping` |
| ListItems | `GET /v1/items` |
| GetItem | `GET /v1/items/{id}` or `/by-slug/{slug}` |

## Ports (billing defaults — change when copying)

| Protocol | Value |
|----------|-------|
| HTTP | 8085 |
| gRPC | 9095 |
| Postgres | 5438 / `druzya_billing` |

## Commands

```bash
cd services/billing
make start
make gen-proto
make lint
make build
```

## References

| Service | Use for |
|---------|---------|
| **billing** | Copy skeleton, minimal CRUD |
| **content** | Single-domain catalog, many RPCs |
| **identity** | Auth, Redis, custom HTTP handlers, interceptors |
