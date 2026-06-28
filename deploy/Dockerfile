# syntax=docker/dockerfile:1
# Build: docker build -f deploy/Dockerfile --build-arg SERVICE=identity -t druzya-identity .
ARG SERVICE=identity
ARG CMD=

FROM golang:1.25-alpine AS builder
ARG SERVICE
ARG CMD
RUN apk add --no-cache git bash make
# Monorepo replace ../sibling in go.mod — copy all services for cross-module imports.
WORKDIR /src
COPY services/ ./services/
WORKDIR /src/services/${SERVICE}
ENV GOWORK=off
# Always regenerate — pre-extracted pkg/api from tarball can be stale after proto RPC changes.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    make gen-proto
# Cross-service replace imports pull sibling pkg/api/google — duplicate proto registration at init.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    mkdir -p .bin && \
    LDFLAGS="-s -w -X google.golang.org/protobuf/reflect/protoregistry.conflictPolicy=ignore" && \
    if [ -n "${CMD}" ]; then \
      go build -ldflags="${LDFLAGS}" -o .bin/${SERVICE} ./cmd/${CMD}; \
    else \
      go build -ldflags="${LDFLAGS}" -o .bin/${SERVICE} ./cmd/${SERVICE}; \
    fi

FROM alpine:3.20
ARG SERVICE
RUN apk add --no-cache ca-certificates tzdata wget \
  && if [ "$SERVICE" = "sandbox" ]; then apk add --no-cache docker-cli; fi
COPY --from=builder /src/services/${SERVICE}/.bin/${SERVICE} /usr/local/bin/service
COPY services/${SERVICE}/scripts/migrations /migrations
USER nobody
EXPOSE 8080 9090
ENTRYPOINT ["/usr/local/bin/service"]
