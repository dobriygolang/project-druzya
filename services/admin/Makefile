.DEFAULT_GOAL := help
SHELL := /bin/bash

SERVICE := admin
HTTP_PORT ?= 8088
GRPC_PORT ?= 9098
BIN_DIR := .bin

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: start
start: ## Run API locally (requires content + JWT keys)
	@echo ""
	@echo "  HTTP  http://localhost:$(HTTP_PORT)/healthz"
	@echo "  gRPC  localhost:$(GRPC_PORT)"
	@echo ""
	@$(MAKE) run

.PHONY: run
run: ## Run API locally
	GOWORK=off go run ./cmd/$(SERVICE)

.PHONY: build
build: ## Build binary to .bin/admin
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
