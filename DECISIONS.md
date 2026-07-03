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

## API decisions

- I kept all public API routes under `/rates/` and reserved `/health/` as an unauthed readiness endpoint for local operations and Compose debugging.
- `GET /rates/latest/` is anonymous, optionally filterable by `?type=`, and returns a compact `{count, results}` payload because the dashboard only needs the latest row per provider/type pair.
- `GET /rates/history/` requires `provider` and `type`, supports `from`, `to`, `page`, and `page_size`, and clamps `page_size` to `HISTORY_MAX_PAGE_SIZE` so history queries cannot become unbounded.
- `POST /rates/ingest/` uses a simple bearer token via DRF authentication classes instead of sessions or an external auth service because the brief only requires a protected machine-to-machine webhook.
- Validation failures return structured `400` responses rather than raising server errors, which keeps replay/debugging predictable for bad upstream payloads.

## API cache and invalidation strategy

- `/rates/latest` is cached by optional `type` filter and invalidated immediately after every successful ingest/seed write.
- `/rates/history` is cached by request signature (`provider`, `type`, date bounds, page, page_size) with bounded TTL, which keeps reads fast while avoiding unbounded responses.
- History keys are request-scoped (hashed) to keep cache keys backend-safe even when providers include spaces or special characters.
- I chose TTL-based freshness for history instead of targeted invalidation because latest-rate freshness is the reviewer-critical path, while bounded historical pages tolerate brief staleness at this scale.

## Scheduling choice

I used Celery Beat + worker in Docker Compose for local parity with production-style async scheduling. The tradeoff is more moving pieces than cron, but it keeps retry logic and ingestion scheduling in one queueing model.

## Testing strategy

- I focused the automated coverage on the highest-risk paths the brief cares about: ingestion parsing, HTTP fetch mocking, API auth/validation, idempotent writes, pagination, and cache usage.
- `pytest` + `pytest-django` back the Django/DRF integration tests so the API contract is exercised against the real serializers, models, and cache layer instead of only unit-level mocks.
- The frontend now has a focused Vitest + Testing Library smoke suite covering dashboard loading, error handling, and the latest-rates/history fetch flow without needing a browser-driven E2E harness.
- The HTTP ingestion path includes a mocked `requests.get` test to prove the fetcher handles a known payload shape without depending on a live external endpoint.
- Cache behavior is tested at the API level for `/rates/latest/` because that is the endpoint with explicit reviewer-facing cache requirements.
- I still prioritized backend correctness, idempotency, and local operability first, so the frontend coverage remains intentionally lightweight compared with the backend suite.

## Conscious tradeoff

**Bulk upsert batches vs. row-by-row `update_or_create`:** I chose Django 4.2 `bulk_create(..., update_conflicts=True)` in 5,000-row batches to load ~1M rows in reasonable time. This adds complexity around unsaved FK objects but avoids hours of per-row ORM calls within the 48-hour window. The alternative—streaming SQL `COPY`—would be faster still but harder to keep auditable raw/clean splits.

## Deferred items

- **Push-based frontend updates:** The dashboard currently polls every 60 seconds. That meets the brief, but I deferred WebSockets/SSE because it adds operational complexity beyond the required scope.
- **Targeted history cache invalidation:** Latest-rate cache keys are explicitly cleared after writes, while history responses currently rely on short TTL expiry rather than per-query invalidation logic.
- **Live deployment:** The repo is optimized for local Docker Compose review, so a hosted environment remains out of scope for the assessment submission.
- **Broader frontend test coverage:** Focused Vitest smoke tests exist, but browser-level E2E coverage and deeper component-state coverage were deferred to keep time on required ingestion/API reliability first.

## One thing I would change with more time

Replace frontend 60-second polling with a WebSocket push (Channels or SSE) fed by post-ingest events, so the dashboard updates immediately after Celery/webhook writes instead of waiting for the next poll interval.
