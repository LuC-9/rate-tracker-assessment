# Rate Tracker

Production-shaped interest rate ingestion, API, and dashboard built for the Senior Full-Stack Developer assessment.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose v2)
- Make (optional, for shortcuts)
- ~2 GB free disk space for the 1M-row seed dataset

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Within ~2 minutes:

- Dashboard: http://localhost:3000
- API: http://localhost:8000/rates/latest/
- Health: http://localhost:8000/health/

On first boot, migrations run automatically and `seed_data` starts in the background when the database is empty. The dashboard shows a loading/empty state until seeding completes.

## Manual seed

```bash
make seed
# or
docker compose run --rm web /app/scripts/entrypoint.sh seed
```

## Run tests

```bash
make test
# or directly
docker compose run --rm web /app/scripts/entrypoint.sh test
```

Tests require PostgreSQL and Redis (provided via Docker Compose).

## Architecture notes

- **Backend:** Django + DRF + PostgreSQL + Redis cache + Celery Beat scheduler
- **Ingestion:** `python manage.py seed_data` loads `rates_seed.parquet` idempotently via `raw_response_id` upserts; optional HTTP fetcher for live sources
- **API:** `/rates/latest` (cached), `/rates/history` (paginated), `/rates/ingest` (Bearer token)
- **Cache invalidation:** Ingest writes invalidate latest-rate cache keys immediately; history responses use short TTL and request-scoped keys for safe eventual freshness
- **Frontend:** Next.js dashboard with sortable table, 30-day chart, 60s auto-refresh, loading/error states

See `DECISIONS.md` for tradeoffs and `schema.md` for database design.

## API examples (curl)

```bash
# Latest rates (optionally by type)
curl "http://localhost:8000/rates/latest/?type=30yr_fixed_mortgage"

# Paginated provider history
curl "http://localhost:8000/rates/history/?provider=hsbc&type=30yr_fixed_mortgage&page=1&page_size=20&from=2026-01-01&to=2026-02-01"

# Health check
curl "http://localhost:8000/health/"

# Authenticated ingest webhook
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

## Environment variables

Copy `.env.example` to `.env`. Required variables are documented there. Set `REQUIRE_ENV_VALIDATION=true` in production to fail fast on missing secrets.

## Project layout

```
backend/          Django project
frontend/         Next.js dashboard
rates_seed.parquet
docker-compose.yml
Makefile
DECISIONS.md
schema.md
```
