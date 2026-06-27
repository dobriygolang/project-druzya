# druzya web (MVP)

React SPA wired to project-druzya microservices.

## Scope

- Auth (Telegram code, Yandex OAuth)
- Mock interview (content catalog → interview session → AI evaluation)
- Recommendations dashboard
- Profile + billing entitlements

## Dev

Backend services must be running (identity :8080, content :8081, interview :8082, recommendation :8084; billing :8085 optional).

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:5173

### Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE` | `/v1` | API prefix (prod: same origin via Caddy) |
| `VITE_TELEGRAM_BOT_USERNAME` | `your_bot` | Deep link on login page |
| `VITE_IDENTITY_URL` | `http://localhost:8080` | Vite dev proxy target |
| `VITE_CONTENT_URL` | `http://localhost:8081` | … |
| `VITE_INTERVIEW_URL` | `http://localhost:8082` | … |
| `VITE_RECOMMENDATION_URL` | `http://localhost:8084` | … |
| `VITE_BILLING_URL` | `http://localhost:8085` | … |

## Build

```bash
npm run build
```

Output: `dist/`

### Production (Docker)

The caddy image embeds the built SPA:

```bash
cd deploy
docker compose -f docker-compose.prod.yml build caddy
```

Set `VITE_API_BASE=/v1` at build time (default in `Dockerfile.caddy`) so the browser calls same-origin `/v1/*` on `api.druz9.ru`.

Local static copy without Docker: `cd deploy && make web-build`.

## API routing (prod)

Same path prefixes as `deploy/Caddyfile`: `/v1/auth`, `/v1/me`, `/v1/companies`, `/v1/interview`, `/v1/recommendations`, `/v1/billing`.
