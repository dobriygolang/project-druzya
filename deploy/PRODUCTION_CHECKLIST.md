# Production checklist — druz9

Что нужно от вас перед деплоем на сервер. После заполнения можно поднять стек одной командой (`cd deploy && make up`).

## 1. Сервер и доступ

| Параметр | Пример | Зачем |
|----------|--------|-------|
| **SSH host** | `203.0.113.10` или `prod.druz9.ru` | Подключение для деплоя |
| **SSH user** | `root` / `deploy` | Пользователь на VPS |
| **SSH private key** | содержимое `~/.ssh/id_ed25519` | Доступ без пароля (или пароль, если без ключа) |
| **OS** | Ubuntu 22.04+ / Debian 12+ | Docker + Compose v2 |
| **Открытые порты** | 80, 443 (и 22 для SSH) | Caddy + Let's Encrypt |

**DNS (вы уже сделали A-записи):**

| Host | Назначение |
|------|------------|
| `api.druz9.online` | API (primary) + OAuth callback |
| `api.druz9.ru` | API mirror |
| **`druz9.online`** | **SPA (canonical)** |
| `app.druz9.online` | SPA alias (same site) |
| `druz9.ru`, `app.druz9.ru` | 301 → `https://druz9.online` |

---

## 2. Файл `deploy/.env`

Скопировать: `cp deploy/.env.example deploy/.env`

### Обязательные секреты

| Переменная | Как получить |
|------------|--------------|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `INTERNAL_API_TOKEN` | `openssl rand -hex 32` — один токен для всех internal gRPC |
| `ADMIN_API_TOKEN` | `openssl rand -hex 32` — content admin RPC |
| `ROOM_INVITE_SECRET` | `openssl rand -hex 32` — HMAC для invite-ссылок live-комнат |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | без `@`, напр. `druzya_bot` |
| `YANDEX_CLIENT_ID` | [OAuth Yandex](https://oauth.yandex.ru/) |
| `YANDEX_CLIENT_SECRET` | там же |
| `YANDEX_REDIRECT_URI` | `https://api.druz9.ru/v1/auth/yandex/callback` |
| `GROQ_API_KEY` (или другой LLM) | минимум один ключ из `LLM_CHAIN_ORDER` |
| `CADDY_EMAIL` | email для Let's Encrypt |

### JWT-ключи

На сервере после клонирования репо:

```bash
cd deploy && make keys
```

Создаёт `deploy/secrets/jwt/private.pem` и `public.pem`. **Не коммитить.**

### Опционально

| Переменная | Когда нужна |
|------------|-------------|
| `CEREBRAS_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` | fallback LLM |
| `TRIBUTE_WEBHOOK_SECRET`, `TRIBUTE_TIER_MAP` | оплата через Tribute |
| `SANDBOX_RUNNER_MODE=docker` | выполнение кода (нужен Docker на хосте) |

---

## 3. OAuth / Telegram — redirect URIs

В консоли Yandex OAuth добавить:

- `https://api.druz9.ru/v1/auth/yandex/callback`
- `https://api.druz9.online/v1/auth/yandex/callback` (если зеркало)

Telegram bot: включить inline / web app по необходимости; `FRONTEND_URL=https://app.druz9.ru`.

---

## 4. GitHub (CI/CD, опционально)

Для автодеплоя через GitHub Actions (`deploy.yml`, когда добавим):

| GitHub Secret | Значение |
|---------------|----------|
| `DEPLOY_SSH_HOST` | IP или hostname |
| `DEPLOY_SSH_USER` | SSH user |
| `DEPLOY_SSH_KEY` | private key (multiline) |
| `DEPLOY_REPO_DIR` | опционально; по умолчанию `/opt/project-druzya` |
| `DEPLOY_BRANCH` | опционально; по умолчанию `main` |

**Первый деплой:** GitHub Actions не клонирует репо сам — один раз вручную на VPS (см. §6). После этого каждый merge в `main` делает `git pull` + `docker compose up`.

Сейчас CI только проверяет build/lint/test — деплой вручную или по SSH.

---

## 5. Linear (опционально)

Нужен только если хотите интеграцию issue → deploy:

| Параметр | Где взять |
|----------|-----------|
| `LINEAR_API_KEY` | Linear → Settings → API |
| Team ID | из URL команды |

В репозитории Linear MCP уже может быть в Cursor; на сервере не обязателен.

---

## 6. Команды деплоя на сервере

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Клонировать репо (путь должен совпадать с deploy workflow — по умолчанию /opt/project-druzya)
sudo mkdir -p /opt
git clone git@github.com:YOUR_ORG/project-druzya.git /opt/project-druzya
cd /opt/project-druzya/deploy

# Альтернатива: ./scripts/bootstrap-server.sh git@github.com:YOUR_ORG/project-druzya.git

# 3. Секреты
cp .env.example .env
nano .env          # заполнить по таблице выше
make keys

# 4. Поднять
make up

# Обновление после git pull (или автодеплой из GitHub Actions):
make deploy   # build + migrate + up --remove-orphans + docker-prune

# Только очистка dangling-образов и build cache (безопасно, volumes не трогает):
make prune

# 5. Smoke test
curl -sf https://api.druz9.ru/healthz
curl -sfI https://app.druz9.ru/
```

---

## 7. Что я могу сделать удалённо

Чтобы **я** зашёл на сервер и настроил всё сам, пришлите в чат (или в Cursor Secrets):

1. **SSH**: `host`, `user`, private key (или временный deploy-ключ только на этот сервер)
2. **Заполненный `.env`** (или значения по таблице выше) — можно частями
3. **GitHub**: org/repo, нужен ли deploy key на сервере для `git pull`
4. **Домен** подтверждение: A-записи уже на IP сервера (вы сказали — да)

Без SSH-ключа и секретов подключиться к вашему VPS из этой среды **нельзя** — нет сетевого доступа к вашему серверу и нет сохранённых credentials.

---

## 8. После деплоя — проверить

- [ ] `https://api.druz9.ru/healthz` → 200
- [ ] `https://api.druz9.ru/readyz` (identity) через compose logs
- [ ] Логин Yandex OAuth
- [ ] Старт mock-интервью
- [ ] Live-комната: `/live/new` → WS подключается
- [ ] `docker compose -f docker-compose.prod.yml ps` — все healthy

См. также: [RUNBOOK.md](./RUNBOOK.md), [PROD_PLAN.md](./PROD_PLAN.md).
