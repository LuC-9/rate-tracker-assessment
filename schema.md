# Database Schema

PostgreSQL schema for the Rate Tracker assessment queries. The design keeps raw ingestion payloads separate from cleaned rate facts so failed parses remain auditable and replayable.

## Tables

### `raw_responses`

Stores every raw payload (seed row or HTTP response) for audit and replay.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Same as parquet `raw_response_id` |
| `provider` | varchar | Raw provider label |
| `rate_type` | varchar | Product type |
| `source_url` | varchar / URL-backed field | Optional upstream source URL |
| `raw_data` | jsonb | Full payload |
| `parsed` | boolean | Whether a cleaned rate was produced |
| `parse_error` | text | Validation/parsing failure reason |
| `created_at` / `updated_at` | timestamptz | Audit timestamps |

### `rates`

Clean, queryable rate facts linked 1:1 to a raw response.

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Surrogate key |
| `provider_raw` | varchar | Original label |
| `provider_normalized` | varchar | Lowercase provider key |
| `rate_type` | varchar | e.g. `30yr_fixed_mortgage` |
| `rate_value` | numeric(15,6) | Percentage value |
| `effective_date` | date | When rate applies |
| `ingestion_timestamp` | timestamptz | When data was ingested |
| `source_url` | varchar / URL-backed field | Optional source URL |
| `currency` | varchar | Normalized currency code |
| `raw_response_id` | UUID FK unique | Idempotency anchor |
| `created_at` / `updated_at` | timestamptz | Audit timestamps inherited from `BaseModel` |

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_provider_type_date` | `(provider_normalized, rate_type, effective_date DESC)` | Latest rate per provider/type |
| `idx_rate_type_date` | `(rate_type, effective_date)` | 30-day change by product type |
| `idx_ingestion_ts` | `(ingestion_timestamp)` | 24-hour ingestion window scans |

## Query patterns

### Latest rate per provider

```sql
SELECT DISTINCT ON (provider_normalized, rate_type)
  *
FROM rates
ORDER BY provider_normalized, rate_type, effective_date DESC, ingestion_timestamp DESC;
```

Implemented via `Rate.get_latest_per_provider()` using PostgreSQL `DISTINCT ON`, ordered by `effective_date` and `ingestion_timestamp` descending so ties resolve to the freshest ingest.

### Rate change over last 30 days for a type

Filter `rates` by `rate_type` and `effective_date >= today - 30 days`, ordered by provider/date. Compare consecutive values per provider in application code or window functions in SQL.

### All records ingested in a 24-hour window

```sql
SELECT *
FROM rates
WHERE ingestion_timestamp >= :start
  AND ingestion_timestamp < :end
ORDER BY ingestion_timestamp DESC;
```

Supported by `Rate.ingested_in_window(start, end)` and the `idx_ingestion_ts` index.

## Why the raw/clean split exists

- `raw_responses` preserves the original payload, parse status, and parse errors for replay/debugging.
- `rates` holds the normalized fields needed for the assessment queries and API responses.
- The one-to-one link from `rates` back to `raw_responses` is the idempotency anchor used during seed and webhook upserts.

## Tradeoffs

- **Raw + clean split** adds storage but satisfies replay requirements and keeps bad rows out of analytics tables.
- **One-to-one raw linkage** simplifies idempotent upserts at the cost of one extra join for full audits.
- **Normalized provider column** avoids case-sensitive duplicates in API aggregations without losing original labels.
- **B-tree composite indexes** are tuned for required assessment reads; a wider covering index could reduce heap access further but would increase write amplification on 1M-row seed loads.
