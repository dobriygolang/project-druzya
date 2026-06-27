# Deprecated — SPA is baked into the caddy image (`deploy/Dockerfile.caddy`).

For local static preview without Docker:

```bash
cd deploy && make web-build
# serves from deploy/static/ if you mount it manually
```

Production: `docker compose build caddy` embeds `apps/web/dist`.
