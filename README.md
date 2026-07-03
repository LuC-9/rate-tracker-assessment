# Rate Tracker

Production-shaped interest rate ingestion, API, and dashboard built for the Senior Full-Stack Developer assessment.

## Prerequisites

- Docker Desktop (or Docker Engine with Compose v2)
- Make (optional, for shortcuts)
- ~2 GB free disk space for the 1M-row seed dataset

## Setup and local run

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Start the full stack:

```bash
docker compose up --build
```

3. Wait for the services to come up. The reviewer-facing expectation is that the dashboard is reachable within about 2 minutes of cloning and starting the stack.

4. Open the running app:

- Dashboard: http://localhost:3000
- API latest endpoint: http://localhost:8000/rates/latest/
- Health endpoint: http://localhost:8000/health/

On first boot, migrations run automatically. If the database is empty and `SEED_ON_STARTUP=true`, the stack also kicks off `seed_data` in the background. The dashboard remains reachable while the initial seed completes, with frontend loading and empty states covering the warm-up window.

## Common commands

```bash
# start / stop
make up
make down

# manual seed
make seed

# tests
make test

# follow logs
make logs
```

Equivalent direct Docker commands:

```bash
docker compose run --rm web /app/scripts/entrypoint.sh seed
docker compose run --rm web /app/scripts/entrypoint.sh test
docker compose logs -f
```

## Environment variables

Copy `.env.example` to `.env` before running the stack. The backend reads these values at startup, while the frontend API base URL is injected from `docker-compose.yml`.

| Variable | Required for local compose | Default / example | Purpose |
|----------|-----------------------------|-------------------|---------|
| `DJANGO_SECRET_KEY` | Yes | `dev-secret-key-change-in-production` | Django secret key |
| `DJANGO_DEBUG` | Yes | `true` | Enables Django debug mode locally |
| `DJANGO_ALLOWED_HOSTS` | Yes | `localhost,127.0.0.1,web` | Allowed Django hosts |
| `DB_NAME` | Yes | `rate_tracker` | PostgreSQL database name |
| `DB_USER` | Yes | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | Yes | `postgres` | PostgreSQL password |
| `DB_HOST` | Yes | `db` | Database host inside Compose |
| `DB_PORT` | Yes | `5432` | Database port |
| `REDIS_URL` | Yes | `redis://redis:6379/0` | Django cache backend URL |
| `CELERY_BROKER_URL` | Yes | `redis://redis:6379/0` | Celery broker |
| `CELERY_RESULT_BACKEND` | Yes | `redis://redis:6379/0` | Celery result backend |
| `INGEST_API_TOKEN` | Yes | `dev-ingest-token` | Bearer token for `POST /rates/ingest/` |
| `SEED_DATA_PATH` | Yes | `/app/rates_seed.parquet` | Path to the parquet seed file |
| `SEED_ON_STARTUP` | Yes | `true` | Runs seed bootstrapping automatically when the DB is empty |
| `INGESTION_BATCH_SIZE` | Yes | `5000` | Bulk upsert batch size for seed ingestion |
| `INGESTION_SCHEDULE_SECONDS` | Yes | `1800` | Celery Beat schedule interval |
| `INGESTION_SOURCE_URL` | No | unset | Optional live HTTP source for scheduled ingestion |
| `CORS_ALLOWED_ORIGINS` | Yes | `http://localhost:3000,http://127.0.0.1:3000` | Frontend origins allowed by Django |
| `CACHE_LATEST_TTL` | Yes | `300` | Cache TTL in seconds for latest and history responses |
| `LOG_FORMAT` | Yes | `json` | Chooses JSON vs verbose console logging |
| `REQUIRE_ENV_VALIDATION` | No | `false` | When `true`, the app exits immediately if `DJANGO_SECRET_KEY`, `INGEST_API_TOKEN`, or `DB_PASSWORD` are missing |
| `NEXT_PUBLIC_API_URL` | Managed in Compose | `http://localhost:8000` | Frontend base URL injected into the Next.js container |

## Fail-fast behavior

The backend supports a fail-fast mode for required secrets. Set `REQUIRE_ENV_VALIDATION=true` to force process startup to exit immediately with a clear error if `DJANGO_SECRET_KEY`, `INGEST_API_TOKEN`, or `DB_PASSWORD` are blank. This is intended for stricter production-like runs; local review defaults stay developer-friendly through `.env.example`.

## Architecture and cache notes

- **Backend stack:** Django + DRF + PostgreSQL + Redis + Celery worker/beat.
- **Ingestion flow:** `python manage.py seed_data` loads `rates_seed.parquet` into `raw_responses` and `rates`, using `raw_response_id` as the idempotency anchor. Scheduled ingestion can also pull from an HTTP source when `INGESTION_SOURCE_URL` is configured.
- **Auditability:** Raw payloads are stored alongside cleaned rate rows so failed or quarantined parses can be replayed later.
- **API surface:** `GET /rates/latest/`, `GET /rates/history/`, and authenticated `POST /rates/ingest/`.
- **Caching:** `/rates/latest/` is cached by optional rate type. `/rates/history/` is cached by a request-specific hashed signature and bounded by TTL so paginated history is never returned as an unbounded query.
- **Cache freshness:** Ingest and seed writes clear the latest-rate cache keys immediately. History responses rely on short-lived request-scoped cache entries rather than targeted invalidation.
- **Frontend:** Next.js dashboard backed by the real API, with sortable latest-rate data, a 30-day chart, auto-refresh every 60 seconds, and explicit loading/error states.

See `DECISIONS.md` for engineering rationale and `schema.md` for database design details.

## API examples

```bash
# latest rates, optionally filtered by type
curl "http://localhost:8000/rates/latest/?type=30yr_fixed_mortgage"

# paginated provider history
curl "http://localhost:8000/rates/history/?provider=hsbc&type=30yr_fixed_mortgage&page=1&page_size=20&from=2026-01-01&to=2026-02-01"

# health check
curl "http://localhost:8000/health/"

# authenticated ingest webhook
curl -X POST "http://localhost:8000/rates/ingest/" \
  -H "Authorization: Bearer $INGEST_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "HSBC",
    "rate_type": "30yr_fixed_mortgage",
    "rate_value": 6.25,
    "effective_date": "2026-07-01",
    "ingestion_timestamp": "2026-07-01T10:00:00Z",
    "currency": "USD",
    "source_url": "https://example.com/rates/hsbc",
    "raw_response_id": "11111111-1111-1111-1111-111111111111"
  }'
```

## Run tests

The automated test suite currently covers ingestion parsing/fetching and the Django REST API contract.

```bash
make test
```

or:

```bash
docker compose run --rm -e DJANGO_SETTINGS_MODULE=rate_tracker.settings -e PYTHONPATH=/app/backend web pytest -q /app/backend/tests
```

Tests expect PostgreSQL and Redis to be available through Docker Compose.

## Video walkthrough

[Add Loom/Drive link before submission]

The recording should show the full local stack running, the dashboard at `localhost:3000`, the API working, and the repository/branch contents used for submission.

## What was deferred

- Replacing the 60-second dashboard polling loop with push-based updates such as WebSockets or SSE.
- A live deployed environment; the repo is intended to be reviewed locally through Docker Compose.
- Targeted history-cache invalidation; history responses currently age out via TTL rather than per-key invalidation.
- The final walkthrough recording link, which is intentionally left as a submission placeholder until the recording phase.

## Project layout

```text
backend/              Django project
frontend/             Next.js dashboard
scripts/              container entrypoints and helpers
rates_seed.parquet    provided 1M-row seed dataset
docker-compose.yml    local stack definition
Makefile              common developer/reviewer commands
DECISIONS.md          engineering decisions and tradeoffs
schema.md             database design notes
```
