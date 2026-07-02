import logging
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from rates.cache_utils import invalidate_rate_caches
from rates.models import RawResponse, Rate, is_valid_rate_value, normalize_currency, normalize_provider_name

logger = logging.getLogger('ingestion')


def _parse_effective_date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    parsed = parse_date(str(value)[:10])
    if parsed:
        return parsed
    raise ValueError(f'Invalid effective_date: {value}')


def _parse_ingestion_ts(value):
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value)
    parsed = parse_datetime(str(value))
    if parsed:
        return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)
    return timezone.now()


def _parse_rate_value(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _build_records(row: dict, source: str = 'seed'):
    raw_id = row.get('raw_response_id') or str(uuid.uuid4())
    raw_uuid = uuid.UUID(str(raw_id))
    provider = row.get('provider', '')
    rate_type = row.get('rate_type', '')
    source_url = row.get('source_url') or None
    raw_data = dict(row)
    raw_data['source'] = source

    rate_value = _parse_rate_value(row.get('rate_value'))
    parse_error = ''
    parsed = False
    effective_date = timezone.now().date()
    ingestion_ts = timezone.now()
    currency = normalize_currency(row.get('currency'))

    try:
        effective_date = _parse_effective_date(row.get('effective_date'))
        ingestion_ts = _parse_ingestion_ts(row.get('ingestion_ts') or row.get('ingestion_timestamp'))
        if rate_value is None:
            parse_error = 'Missing or invalid rate_value'
        elif not is_valid_rate_value(rate_value):
            parse_error = f'Rate value out of range: {rate_value}'
        else:
            parsed = True
    except ValueError as exc:
        parse_error = str(exc)

    raw = RawResponse(
        id=raw_uuid,
        provider=provider,
        rate_type=rate_type,
        source_url=source_url,
        raw_data=raw_data,
        parsed=parsed,
        parse_error=parse_error,
    )
    rate = None
    if parsed:
        rate = Rate(
            provider_raw=provider,
            provider_normalized=normalize_provider_name(provider),
            rate_type=rate_type,
            rate_value=rate_value,
            effective_date=effective_date,
            ingestion_timestamp=ingestion_ts,
            source_url=source_url,
            raw_response=raw,
            currency=currency,
        )
    return raw, rate


def persist_rate_record(row: dict, source: str = 'seed') -> tuple[Rate | None, RawResponse]:
    raw, rate = _build_records(row, source=source)
    with transaction.atomic():
        RawResponse.objects.update_or_create(
            id=raw.id,
            defaults={
                'provider': raw.provider,
                'rate_type': raw.rate_type,
                'source_url': raw.source_url,
                'raw_data': raw.raw_data,
                'parsed': raw.parsed,
                'parse_error': raw.parse_error,
            },
        )
        raw_response = RawResponse.objects.get(id=raw.id)
        if rate is None:
            Rate.objects.filter(raw_response=raw_response).delete()
            return None, raw_response

        rate_obj, _ = Rate.objects.update_or_create(
            raw_response=raw_response,
            defaults={
                'provider_raw': rate.provider_raw,
                'provider_normalized': rate.provider_normalized,
                'rate_type': rate.rate_type,
                'rate_value': rate.rate_value,
                'effective_date': rate.effective_date,
                'ingestion_timestamp': rate.ingestion_timestamp,
                'source_url': rate.source_url,
                'currency': rate.currency,
            },
        )
    invalidate_rate_caches(rate_type=rate_obj.rate_type, provider=rate_obj.provider_normalized)
    return rate_obj, raw_response


def load_parquet_file(path: str, batch_size: int = 5000, max_rows: int | None = None) -> dict:
    import pandas as pd

    logger.info('Starting parquet seed load', extra={'path': path, 'batch_size': batch_size})
    df = pd.read_parquet(path)
    if max_rows is not None:
        df = df.head(max_rows)
    total = len(df)
    skipped = persisted = 0

    for start in range(0, total, batch_size):
        batch = df.iloc[start : start + batch_size]
        raw_objects = []
        rate_objects = []

        for record in batch.to_dict(orient='records'):
            row = {
                'provider': record.get('provider'),
                'rate_type': record.get('rate_type'),
                'rate_value': record.get('rate_value'),
                'effective_date': record.get('effective_date'),
                'ingestion_ts': record.get('ingestion_ts'),
                'source_url': record.get('source_url'),
                'currency': record.get('currency'),
                'raw_response_id': record.get('raw_response_id'),
            }
            raw, rate = _build_records(row, source='seed')
            raw_objects.append(raw)
            if rate is None:
                skipped += 1
            else:
                rate_objects.append(rate)

        with transaction.atomic():
            RawResponse.objects.bulk_create(
                raw_objects,
                update_conflicts=True,
                unique_fields=['id'],
                update_fields=['provider', 'rate_type', 'source_url', 'raw_data', 'parsed', 'parse_error', 'updated_at'],
            )
            if rate_objects:
                Rate.objects.bulk_create(
                    rate_objects,
                    update_conflicts=True,
                    unique_fields=['raw_response'],
                    update_fields=[
                        'provider_raw',
                        'provider_normalized',
                        'rate_type',
                        'rate_value',
                        'effective_date',
                        'ingestion_timestamp',
                        'source_url',
                        'currency',
                        'updated_at',
                    ],
                )
                persisted += len(rate_objects)

        logger.info(
            'Batch complete',
            extra={'processed': min(start + batch_size, total), 'total': total},
        )

    invalidate_rate_caches()
    summary = {
        'total_rows': total,
        'persisted_rates': persisted,
        'skipped_unparsed': skipped,
    }
    logger.info('Parquet seed load complete', extra=summary)
    return summary
