SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.prod.yml --env-file .env

.PHONY: help keys build web-build up down logs migrate ps monitoring backup prune ensure-pkg-api deploy smoke

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

up: keys ## Start full prod stack (generates JWT keys if missing; includes monitoring)
	$(COMPOSE) --profile monitoring up -d

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

ensure-pkg-api: ## Fail fast when pkg/api is missing (manual deploy: run gen-all-proto from repo root)
	@root=$$(cd .. && pwd); \
	source scripts/services.conf.sh; \
	verify_pkg_api "$$root"

deploy: keys ensure-pkg-api ## Pull-less prod update: build changed images, migrate if needed, up, prune
	@CUR=$$(git rev-parse HEAD); \
	PREV=$$(cat .last-deploy-sha 2>/dev/null || true); \
	  export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 BUILDX_NO_DEFAULT_ATTESTATIONS=1 COMPOSE_PARALLEL_LIMIT=$${COMPOSE_PARALLEL_LIMIT:-4}; \
	if [ -z "$$PREV" ]; then \
	  $(COMPOSE) build; \
	elif [ "$$PREV" = "$$CUR" ]; then \
	  echo "No image rebuild needed (same commit)."; \
	else \
	  TARGETS=$$(bash scripts/changed-services.sh "$$PREV" "$$CUR" | xargs || true); \
	  if [ -n "$$TARGETS" ]; then \
	    echo "Incremental build: $$TARGETS"; \
	    bash scripts/build-images.sh $$TARGETS; \
	  else \
	    echo "No image rebuild needed (no service changes)."; \
	  fi; \
	fi; \
	if [ -z "$$PREV" ] || [ "$$PREV" = "$$CUR" ] || (source scripts/services.conf.sh && migrations_changed "$$PREV" "$$CUR"); then \
	  $(COMPOSE) run --rm migrate; \
	else \
	  echo "Skipping migrate (no migration changes)."; \
	fi; \
	$(COMPOSE) --profile monitoring up -d --remove-orphans --wait --wait-timeout 300; \
	echo $$CUR > .last-deploy-sha; \
	./scripts/docker-prune.sh

smoke: ## Run smoke checks against running stack (API_BASE, INTERNAL_API_TOKEN optional)
	@./scripts/smoke-core-loop.sh
