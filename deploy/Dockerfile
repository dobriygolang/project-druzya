# syntax=docker/dockerfile:1
# Build: docker build -f deploy/Dockerfile --build-arg SERVICE=identity -t druzya-identity .
ARG SERVICE=identity
ARG CMD=

FROM golang:1.25-alpine AS gopls
RUN go install golang.org/x/tools/gopls@v0.19.1

FROM golang:1.25-alpine AS builder
ARG SERVICE
ARG CMD
RUN apk add --no-cache git bash make
# Monorepo replace ../sibling in go.mod — copy all services for cross-module imports.
WORKDIR /src
COPY services/ ./services/
ENV GOWORK=off
# replace ../sibling imports use other services' pkg/api (gitignored) — generate all protos.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    for d in /src/services/*/; do \
      if [ -f "$d/buf.yaml" ]; then \
        (cd "$d" && make gen-proto) || exit 1; \
      fi; \
    done
WORKDIR /src/services/${SERVICE}
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
RUN mkdir -p /out/migrations && \
    if [ -d scripts/migrations ]; then cp -a scripts/migrations/. /out/migrations/; fi

FROM alpine:3.20
ARG SERVICE
RUN apk add --no-cache ca-certificates tzdata wget \
  && if [ "$SERVICE" = "sandbox" ]; then apk add --no-cache docker-cli; fi
COPY --from=builder /src/services/${SERVICE}/.bin/${SERVICE} /usr/local/bin/service
COPY --from=gopls /go/bin/gopls /usr/local/bin/gopls
COPY --from=builder /out/migrations /migrations
USER nobody
EXPOSE 8080 9090
ENTRYPOINT ["/usr/local/bin/service"]
