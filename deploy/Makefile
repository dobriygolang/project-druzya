SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.prod.yml --env-file .env

.PHONY: help keys build web-build up down logs migrate ps monitoring backup prune deploy

help: ## Show deploy commands
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

keys: ## Generate JWT RS256 keys in secrets/jwt/
	@./scripts/gen-jwt-keys.sh

web-build: ## Build apps/web into deploy/static (local preview without Docker)
	cd ../apps/web && npm ci && npm run build
	rm -rf static/*
	cp -r ../apps/web/dist/* static/

build: ## Build all prod images (includes SPA in caddy image)
	$(COMPOSE) build

up: keys ## Start full prod stack (generates JWT keys if missing)
	$(COMPOSE) up -d

down: ## Stop prod stack
	$(COMPOSE) down

logs: ## Tail all service logs
	$(COMPOSE) logs -f

migrate: ## Run migrations only
	$(COMPOSE) run --rm migrate

reset-db: ## Drop and recreate all application databases (then run migrate)
	@set -a && . ./.env && set +a && USE_DOCKER_POSTGRES=1 ENV_FILE=.env ./scripts/reset-databases.sh

ps: ## Show running containers
	$(COMPOSE) ps

monitoring: ## Start Prometheus + Grafana (profile monitoring)
	$(COMPOSE) --profile monitoring up -d prometheus grafana

backup: ## Dump all Postgres databases (requires pg_dump + .env)
	@set -a && . ./.env && set +a && ./scripts/backup-postgres.sh

prune: ## Remove dangling images and old build cache (safe after deploy)
	@./scripts/docker-prune.sh

deploy: keys ## Pull-less prod update: build, migrate, up, prune (run from deploy/ on server)
	$(COMPOSE) build
	$(COMPOSE) run --rm migrate
	$(COMPOSE) up -d --remove-orphans --wait --wait-timeout 300
	@./scripts/docker-prune.sh
