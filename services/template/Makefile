.DEFAULT_GOAL := help
SHELL := /bin/bash

SERVICE := template
HTTP_PORT ?= 8099
GRPC_PORT ?= 9199
GOOSE_DSN ?= host=localhost port=5439 user=postgres password=postgres dbname=druzya_template sslmode=disable
MIGRATIONS_DIR := scripts/migrations
COMPOSE_FILE := scripts/dev/docker-compose.yml
GOOSE := GOWORK=off go run github.com/pressly/goose/v3/cmd/goose@v3.19.2
BIN_DIR := .bin

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: start-deps
start-deps: ## Start postgres (Docker)
	docker compose -f $(COMPOSE_FILE) up -d postgres
	@echo "  waiting for postgres..."
	@until docker compose -f $(COMPOSE_FILE) exec -T postgres pg_isready -U postgres -d druzya_template >/dev/null 2>&1; do sleep 1; done

.PHONY: migrate-up
migrate-up: ## Apply pending SQL migrations
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(GOOSE_DSN)" up

.PHONY: migrate-down
migrate-down: ## Roll back last migration
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(GOOSE_DSN)" down

.PHONY: migrate-status
migrate-status: ## Show migration status
	$(GOOSE) -dir $(MIGRATIONS_DIR) postgres "$(GOOSE_DSN)" status

.PHONY: migrate-new
migrate-new: ## Create migration. Usage: make migrate-new NAME=add_foo
	@if [ -z "$(NAME)" ]; then echo "Usage: make migrate-new NAME=<snake_name>"; exit 1; fi
	@LAST=$$(ls $(MIGRATIONS_DIR)/[0-9]*.sql 2>/dev/null | sed -E 's|.*/0*([0-9]+)_.*|\1|' | sort -n | tail -1); \
	LAST=$${LAST:-0}; NEXT=$$(printf "%05d" $$((LAST + 1))); \
	FILE="$(MIGRATIONS_DIR)/$${NEXT}_$(NAME).sql"; \
	printf -- "-- +goose Up\n-- +goose StatementBegin\n\n-- +goose StatementEnd\n\n-- +goose Down\n-- +goose StatementBegin\nSELECT 1;\n-- +goose StatementEnd\n" > "$$FILE"; \
	echo "created $$FILE"

.PHONY: start
start: start-deps migrate-up ## Deps + migrations + run API
	@echo ""
	@echo "  HTTP  http://localhost:$(HTTP_PORT)/healthz"
	@echo "  gRPC  localhost:$(GRPC_PORT)"
	@echo ""
	@$(MAKE) run

.PHONY: run
run: ## Run API locally
	GOWORK=off go run ./cmd/$(SERVICE)

.PHONY: stop
stop: ## Stop docker deps
	docker compose -f $(COMPOSE_FILE) down

.PHONY: build
build: ## Build binary to .bin/template
	@mkdir -p $(BIN_DIR)
	GOWORK=off go build -o $(BIN_DIR)/$(SERVICE) ./cmd/$(SERVICE)

.PHONY: test
test: ## Run tests with race detector
	GOWORK=off go test -race -count=1 ./...

.PHONY: lint
lint: lint-go lint-proto lint-tidy ## Run all linters

.PHONY: lint-go
lint-go: ## golangci-lint
	@GOWORK=off golangci-lint run --config=.golangci.yml --timeout=5m ./...

.PHONY: lint-proto
lint-proto: bin-buf ## buf lint
	@GOWORK=off PATH="$(CURDIR)/$(BIN_DIR):$$PATH" $(BIN_DIR)/buf lint

.PHONY: lint-tidy
lint-tidy: ## Fail if go.mod drift
	@GOWORK=off GOFLAGS="-mod=readonly" go build ./... >/dev/null 2>&1 || { echo "go.mod drift — run 'make tidy'"; exit 1; }

.PHONY: tidy
tidy: ## go mod tidy
	GOWORK=off go mod tidy

.PHONY: bin-buf bin-protoc-gen-go bin-protoc-gen-go-grpc bin-protoc-gen-grpc-gateway
bin-buf:
	@mkdir -p $(BIN_DIR)
	@GOWORK=off GOBIN="$(CURDIR)/$(BIN_DIR)" go install github.com/bufbuild/buf/cmd/buf@v1.47.0

bin-protoc-gen-go:
	@mkdir -p $(BIN_DIR)
	@GOWORK=off GOBIN="$(CURDIR)/$(BIN_DIR)" go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11

bin-protoc-gen-go-grpc:
	@mkdir -p $(BIN_DIR)
	@GOWORK=off GOBIN="$(CURDIR)/$(BIN_DIR)" go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2

bin-protoc-gen-grpc-gateway:
	@mkdir -p $(BIN_DIR)
	@GOWORK=off GOBIN="$(CURDIR)/$(BIN_DIR)" go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@v2.29.0

.PHONY: gen-proto
gen-proto: bin-buf bin-protoc-gen-go bin-protoc-gen-go-grpc bin-protoc-gen-grpc-gateway ## Generate pkg/api
	@GOWORK=off PATH="$(CURDIR)/$(BIN_DIR):$$PATH" $(BIN_DIR)/buf generate
