> **ARCHIVED** — admin service removed. See [onboarding README](../onboarding/README.md#retired-services).

# Admin panel

Operator BFF: `services/admin/` — **removed**.

## Decisions (historical)

| Topic | Choice |
|-------|--------|
| Shape | Stateless BFF, no domain DB |
| Auth | JWT + `ADMIN_USER_IDS` allowlist |
| Content writes | Granular RPC + `ReplaceTemplateStructure` |
| LLM config | Stored in ai DB; admin proxies ai gRPC |

```
/admin UI → /v1/admin/* → admin BFF → identity | content | billing | ai
```

Secrets stay on server (`CONTENT_ADMIN_TOKEN`, `INTERNAL_API_TOKEN`).

## Phases (all shipped)

0–1 session + content CRUD · 2 templates · 3 billing · 4 AI/LLM · 5 dashboard · 6 articles/KB

## Dashboard snapshot

`GET /v1/admin/dashboard` — users, signups, service health, catalog counts, eval job stats, LLM config. Business metrics from SQL, not Prometheus.

Monitoring: [deploy/grafana/README.md](../../deploy/grafana/README.md)
