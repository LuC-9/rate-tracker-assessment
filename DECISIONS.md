# Engineering Decisions

## Assumptions

- The seed parquet is the authoritative bulk source for local/demo ingestion; live HTTP ingestion is optional via `INGESTION_SOURCE_URL`.
- Financial rates are expressed as percentages between 0 and 20; null, negative, or extreme values are quarantined in `raw_responses` with `parsed=false`.
- Provider identity is case-insensitive (`hsbc`, `Hsbc`, `HSBC` → `hsbc`).
- "Latest rate per provider" means the row with the greatest `(effective_date, ingestion_timestamp)` per `(provider_normalized, rate_type)`.
- Reviewers run the stack via Docker Compose on a laptop; background seeding keeps the dashboard reachable within two minutes even while 1M rows load.

## Idempotency strategy

Every seed/API row carries a unique `raw_response_id` (UUID). Ingestion uses PostgreSQL upserts:

1. Upsert `raw_responses` on primary key `id`.
2. Upsert `rates` on one-to-one `raw_response_id`.
3. Re-running `python manage.py seed_data` updates existing rows instead of duplicating them.

Data quality handling:

| Issue | Handling |
|-------|----------|
| Provider casing duplicates | Normalize to lowercase on write |
| Currency variants (`USD`, `usd`, `US Dollar`) | Map aliases to ISO-like codes |
| Null / out-of-range rate values | Store raw row, skip cleaned `rates` row, set `parsed=false` |
| Duplicate business keys | Allowed in raw data; latest wins for `/rates/latest` via ordering |

Failed HTTP parses remain in `raw_responses` for replay; Celery retries transient network failures.

## API cache and invalidation strategy

- `/rates/latest` is cached by optional `type` filter and invalidated immediately after every successful ingest/seed write.
- `/rates/history` is cached by request signature (`provider`, `type`, date bounds, page, page_size) with bounded TTL, which keeps reads fast while avoiding stale unbounded keys.
- History keys are request-scoped (hashed) to keep cache keys backend-safe even when providers include spaces/special characters.

## Scheduling choice

I used Celery Beat + worker in Docker Compose for local parity with production-style async scheduling. The tradeoff is more moving pieces than cron, but it keeps retry logic and ingestion scheduling in one queueing model.

## Conscious tradeoff

**Bulk upsert batches vs. row-by-row `update_or_create`:** I chose Django 4.2 `bulk_create(..., update_conflicts=True)` in 5,000-row batches to load ~1M rows in reasonable time. This adds complexity around unsaved FK objects but avoids hours of per-row ORM calls within the 48-hour window. The alternative—streaming SQL `COPY`—would be faster still but harder to keep auditable raw/clean splits.

## One thing I would change with more time

Replace frontend 60-second polling with a WebSocket push (Channels or SSE) fed by post-ingest events, so the dashboard updates immediately after Celery/webhook writes instead of waiting for the next poll interval.
