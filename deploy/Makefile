SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.prod.yml --env-file .env

.PHONY: help keys build web-build up down logs migrate ps monitoring backup

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

ps: ## Show running containers
	$(COMPOSE) ps

monitoring: ## Start Prometheus + Grafana (profile monitoring)
	$(COMPOSE) --profile monitoring up -d prometheus grafana

backup: ## Dump all Postgres databases (requires pg_dump + .env)
	@set -a && . ./.env && set +a && ./scripts/backup-postgres.sh
