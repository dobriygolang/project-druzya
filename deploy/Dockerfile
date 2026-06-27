# syntax=docker/dockerfile:1
# Build: docker build -f deploy/Dockerfile --build-arg SERVICE=identity -t druzya-identity .
ARG SERVICE=identity
ARG CMD=

FROM golang:1.25-alpine AS builder
ARG SERVICE
ARG CMD
RUN apk add --no-cache git bash make
WORKDIR /src/services/${SERVICE}
COPY services/${SERVICE}/ ./
ENV GOWORK=off
RUN make gen-proto
RUN mkdir -p .bin
RUN if [ -n "${CMD}" ]; then \
      go build -ldflags="-s -w" -o .bin/${SERVICE} ./cmd/${CMD}; \
    else \
      go build -ldflags="-s -w" -o .bin/${SERVICE} ./cmd/${SERVICE}; \
    fi

FROM alpine:3.20
ARG SERVICE
RUN apk add --no-cache ca-certificates tzdata wget
COPY --from=builder /src/services/${SERVICE}/.bin/${SERVICE} /usr/local/bin/service
COPY services/${SERVICE}/scripts/migrations /migrations
USER nobody
EXPOSE 8080 9090
ENTRYPOINT ["/usr/local/bin/service"]
