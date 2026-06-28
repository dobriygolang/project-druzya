# Grafana — druzya observability

Self-hosted Prometheus + Grafana on the production server (~300–500 MB RAM total). Grafana Cloud is optional (see bottom).

## 1. Self-hosted (recommended)

Add to `deploy/.env`:

```bash
GRAFANA_ADMIN_PASSWORD=your-strong-password
```

Start the stack:

```bash
cd deploy
docker compose -f docker-compose.prod.yml --profile monitoring up -d prometheus grafana
```

| **Grafana** | http://127.0.0.1:3000 (SSH tunnel) or **https://grafana.druz9.online** | `admin` / `$GRAFANA_ADMIN_PASSWORD` |

SSH tunnel (Prometheus only): `ssh -L 9099:127.0.0.1:9099 root@server` → http://localhost:9099

Public Grafana: **https://grafana.druz9.online** (login `admin` / `$GRAFANA_ADMIN_PASSWORD`).

Dashboards in folder **druzya** are auto-imported from `deploy/grafana/dashboards/` (Prometheus datasource is provisioned automatically).

Verify in Grafana → Explore:

```promql
sum by (service) (rate(http_requests_total[5m]))
```

## 2. Grafana Cloud (optional)

1. Open your Grafana Cloud stack (after sign-up at [grafana.com](https://grafana.com/auth/sign-up/loading-instance)).
2. **Connections → Add new connection → Prometheus → Via Prometheus remote_write**.
3. Copy:
   - **Remote write URL** → `GRAFANA_CLOUD_PROMETHEUS_URL`
   - **Username / Instance ID** → `GRAFANA_CLOUD_PROMETHEUS_USER`
   - **Password / API key** → `GRAFANA_CLOUD_PROMETHEUS_API_KEY`

Add to `deploy/.env`:

```bash
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-prod-XX-prod-YY-ZZ.grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USER=123456
GRAFANA_CLOUD_PROMETHEUS_API_KEY=glc_...
```

Optional (for importing dashboards via CLI):

```bash
GRAFANA_CLOUD_STACK_URL=https://yourstack.grafana.net
GRAFANA_CLOUD_API_KEY=glc_...
```

## 2. Start the Alloy agent (production)

Alloy scrapes each service `/metrics` endpoint and remote-writes to Grafana Cloud.

```bash
cd deploy
docker compose -f docker-compose.prod.yml --profile monitoring up -d alloy
```

Verify in Grafana Cloud → **Explore → Prometheus**:

```promql
sum by (service) (rate(http_requests_total[5m]))
```

## 3. Import dashboards

In Grafana Cloud UI:

1. **Dashboards → New → Import**
2. Upload JSON from `deploy/grafana/dashboards/`:
   - `druzya-platform.json` — host memory/disk, HTTP RPS, latency, process RSS
   - `druzya-http-routes.json` — RPS table and top routes by handler
   - `druzya-ai-llm.json` — LLM calls, outbox lag (ai + recommendation)

Or via API:

```bash
curl -X POST "$GRAFANA_CLOUD_STACK_URL/api/dashboards/db" \
  -H "Authorization: Bearer $GRAFANA_CLOUD_API_KEY" \
  -H "Content-Type: application/json" \
  -d @deploy/grafana/dashboards/druzya-platform.json
```

## 4. Local stack (dev)

Same as self-hosted — run from `deploy/` with `--profile monitoring`.

## Metrics reference

| Metric | Source | Use |
|--------|--------|-----|
| `http_requests_total{service,route,method,status}` | all HTTP services | RPS by route, error rate |
| `http_request_duration_seconds` | all HTTP services | latency p95 |
| `process_resident_memory_bytes` | Go default collectors | RSS |
| `go_goroutines` | Go default collectors | goroutine count |
| `node_memory_*`, `node_filesystem_*` | node_exporter | host RAM and disk |
| `llm_calls_total{provider,result}` | ai, recommendation | LLM health |
| `llm_call_duration_seconds` | ai, recommendation | LLM latency |
| `outbox_lag_seconds` | ai, recommendation | queue backlog |

Business metrics (user counts, DB size) stay in **admin `/admin` dashboard** — they come from SQL, not Prometheus.
