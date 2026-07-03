# Operations Runbook

This runbook documents the local operational paths for the Rate Tracker stack. It is based on the Compose services, container entrypoints, Django settings, and ingestion code in this repository.

## Service topology

| Service | Purpose | Key command / codepath |
|---------|---------|------------------------|
| `db` | PostgreSQL 16 database for raw and cleaned rate data | `docker-compose.yml` |
| `redis` | Django cache, Celery broker, Celery result backend | `docker-compose.yml` |
| `web` | Django + DRF API served by Gunicorn on port `8000` | `scripts/entrypoint.sh web` |
| `celery` | Async worker for ingestion tasks | `scripts/entrypoint.sh celery` |
| `celery-beat` | Scheduler for recurring ingestion | `scripts/entrypoint.sh beat` |
| `frontend` | Next.js dashboard on port `3000` | `frontend/Dockerfile` |

The public local endpoints are:

- Dashboard: `http://localhost:3000`
- Latest rates API: `http://localhost:8000/rates/latest/`
- History API: `http://localhost:8000/rates/history/`
- Health check: `http://localhost:8000/health/`

## Startup sequence

Run the full stack from the repository root:

```bash
cp .env.example .env
docker compose up --build
```

The `web`, `celery`, `celery-beat`, `seed`, and `test` entrypoint modes source `scripts/wait-for-services.sh` before running their command:

1. Wait for PostgreSQL using the configured `DB_*` variables.
2. Wait for Redis using `REDIS_URL`.
3. Run `python manage.py migrate --noinput`.
4. If `SEED_ON_STARTUP=true` and the `rates` table is empty, start `python manage.py seed_data` in the background.

Because startup seeding is backgrounded, the API and dashboard can become reachable before all seed rows have loaded. During that warm-up window, the dashboard may show loading or empty states until `/rates/latest/` has data.

## Seeding and ingestion workflows

### Bulk seed load

`python manage.py seed_data` loads `rates_seed.parquet` from `SEED_DATA_PATH` and writes:

- raw payloads to `raw_responses`
- cleaned, queryable rows to `rates`

The loader uses `raw_response_id` as the idempotency anchor, so re-running the seed updates existing rows instead of duplicating them.

Common commands:

```bash
make seed
docker compose run --rm web /app/scripts/entrypoint.sh seed
docker compose run --rm web python manage.py seed_data --batch-size 1000
```

Expected seed columns are `provider`, `rate_type`, `rate_value`, `effective_date`, `ingestion_ts`, `source_url`, `currency`, and `raw_response_id`.

### Authenticated webhook ingest

`POST /rates/ingest/` accepts one rate record and requires `Authorization: Bearer $INGEST_API_TOKEN`.

```bash
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

Validation constraints:

- `rate_value` must be between `0` and `20`.
- `provider` is normalized to lowercase for lookups while preserving `provider_raw`.
- `currency` defaults to `USD` and maps known aliases such as `US Dollar` to `USD`.
- Reusing a `raw_response_id` updates the existing raw/clean pair.

### Scheduled ingestion

Celery Beat schedules `ingestion.tasks.run_ingestion` every `INGESTION_SCHEDULE_SECONDS` seconds.

- If `INGESTION_SOURCE_URL` is set, the worker fetches JSON from that URL and parses it like webhook data.
- If `INGESTION_SOURCE_URL` is unset, the worker re-processes the first 500 rows of `SEED_DATA_PATH` to demonstrate an idempotent scheduled load.
- HTTP fetches use `INGESTION_WORKER_TIMEOUT` and retry up to `INGESTION_RETRY_ATTEMPTS` inside the fetcher. Celery task failures retry after 60 seconds, up to the task retry limit.

## Cache freshness

- `GET /rates/latest/` is cached by optional `type` filter for `CACHE_LATEST_TTL` seconds.
- Seed loads and successful ingests invalidate latest-rate cache keys immediately.
- `GET /rates/history/` is cached by a hashed request signature. History responses age out by TTL rather than targeted invalidation.

## Troubleshooting

| Symptom | Likely cause | What to check |
|---------|--------------|---------------|
| Backend image build fails with a missing seed file | `backend/Dockerfile` copies `rates_seed.parquet` into the image | Confirm `rates_seed.parquet` exists at the repository root before building or running CI. |
| Backend exits at startup with a missing env var | `REQUIRE_ENV_VALIDATION=true` requires `DJANGO_SECRET_KEY`, `INGEST_API_TOKEN`, and `DB_PASSWORD` | Copy `.env.example` to `.env` and keep required values non-empty. |
| Dashboard is reachable but shows no rates | Background seed is still running, seeding failed, or the database was started empty with `SEED_ON_STARTUP=false` | Run `docker compose logs -f web` and look for seed progress, then run `make seed` if needed. |
| Scheduled ingestion logs `seed file missing` | `INGESTION_SOURCE_URL` is unset and `SEED_DATA_PATH` does not exist in the worker container | Provide the seed file at `SEED_DATA_PATH` or configure `INGESTION_SOURCE_URL`. |
| `POST /rates/ingest/` returns `401` | Missing or incorrect bearer token | Send `Authorization: Bearer $INGEST_API_TOKEN`; the token must match the backend environment. |
| Frontend cannot load API data | API is unavailable, `NEXT_PUBLIC_API_URL` points elsewhere, or CORS origins do not include the dashboard | Check `docker compose ps`, `NEXT_PUBLIC_API_URL`, and `CORS_ALLOWED_ORIGINS`. |
| History requests return `400` | Required query params or date/page formats are invalid | Include `provider` and `type`; use `YYYY-MM-DD` for `from`/`to`, integer `page`, and positive `page_size`. |

## Verification commands

```bash
# backend tests through Compose
make test

# frontend lint, tests, and production build
cd frontend
npm ci
npm run lint
npm test
npm run build
```

CI runs backend tests through Docker Compose plus frontend install, lint, test, and build steps.
