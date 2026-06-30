# Outbox relay (P2-1 design)

> **Archived (2026):** Interview/recommendation services were removed from prod. This doc describes the original relay design; polling was the default before retirement. NATS is no longer in prod compose.

## Problem (historical)

Today ai and recommendation poll interview internal API every ~2s:

```
interview.domain_outbox
  ← ClaimOutboxEvents (ai: attempt_submitted)
  ← ClaimOutboxEvents (recommendation: 4 event types)
```

Drawbacks at scale:

- Extra load on interview Postgres (`FOR UPDATE SKIP LOCKED` per consumer × event type)
- Claim latency bounded by poll interval (p99 lag ≈ interval + handler time)
- Tight coupling: consumers need interview internal token + gRPC availability

## Target flow

```
interview (writer)
  INSERT domain_outbox + domain row  (same tx, unchanged)
  relay worker (new, in interview)
    claim pending rows (single owner)
    publish to NATS subject per event_name
    ack row only after broker confirms

ai / recommendation
  subscribe to owned subjects
  idempotent handlers (same as today)
  no ClaimOutboxEvents calls
```

## Subject map (proposal)

| Subject | Current consumer |
|---------|------------------|
| `interview.attempt_submitted` | ai-service |
| `interview.attempt_evaluated` | recommendation |
| `interview.session_completed` | recommendation |
| `interview.retry_item_created` | recommendation |
| `interview.task_skipped` | recommendation |

Payload: JSON from `domain_outbox.payload` + envelope `{ "event_id", "event_name", "occurred_at" }`.

## Migration phases

1. **Dual-write (optional):** relay publishes while consumers still poll; compare metrics (`outbox_lag_seconds`, handler errors).
2. **Cutover per consumer:** feature flag `OUTBOX_POLL_ENABLED=false`; consumer reads from bus only.
3. **Remove poll workers** from ai/recommendation; keep internal Ack RPC or mark rows published in relay only.

## Idempotency

Keep `processed_events(consumer, event_id)` in recommendation (and ai job table keyed by `attempt_id`). Bus delivery is at-least-once.

## Ops

- Relay is single-writer to outbox claims — no race with ai/recommendation poll (today's multi-consumer split stays until cutover).
- Dead-letter: NATS JetStream or Kafka compacted retry topic for rows stuck after N publish failures.
- Metrics: `outbox_relay_publish_total`, `outbox_lag_seconds` (already planned at consume side).

## Local dev

Optional NATS in `services/interview/scripts/dev/docker-compose.yml` (when added) and env `NATS_URL`. **Default:** polling when `NATS_URL` is unset.

Prod (`deploy/docker-compose.prod.yml`): `nats` service + `OUTBOX_RELAY_ENABLED=true` on interview, `OUTBOX_POLL_ENABLED=false` on ai/recommendation.
