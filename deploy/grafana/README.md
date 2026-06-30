# Grafana — druzya

## Self-hosted (default)

```bash
# deploy/.env
GRAFANA_ADMIN_PASSWORD=...

cd deploy
docker compose -f docker-compose.prod.yml --profile monitoring up -d prometheus grafana
```

| UI | URL |
|----|-----|
| Grafana | https://grafana.druz9.online (`admin` / `$GRAFANA_ADMIN_PASSWORD`) |
| Prometheus (tunnel) | `ssh -L 9099:127.0.0.1:9099 root@server` → localhost:9099 |

Dashboards auto-import from `deploy/grafana/dashboards/`.

## Grafana Cloud (optional)

Set in `.env`:

```bash
GRAFANA_CLOUD_PROMETHEUS_URL=...
GRAFANA_CLOUD_PROMETHEUS_USER=...
GRAFANA_CLOUD_PROMETHEUS_API_KEY=...
```

Start Alloy: `docker compose … --profile monitoring up -d alloy`

Import JSON dashboards from `deploy/grafana/dashboards/` via UI or API.

## Key metrics

| Metric | Use |
|--------|-----|
| `http_requests_total`, `http_request_duration_seconds` | RPS, latency |
| `up` | service health (see `deploy/prometheus-alerts.yml`) |
| `llm_calls_total` | LLM health (ai service, CI only) |
| `node_memory_*` | host RAM (node_exporter) |

Retired services (interview, recommendation, admin) are no longer scraped.
