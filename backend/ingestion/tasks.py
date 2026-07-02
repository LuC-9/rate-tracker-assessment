import logging
import os

from celery import shared_task
from django.conf import settings

logger = logging.getLogger('ingestion')


@shared_task(bind=True, max_retries=3)
def run_ingestion(self):
    """
    Scheduled ingestion task.

    When INGESTION_SOURCE_URL is set, fetches live data. Otherwise re-processes
    a small slice of the seed file to demonstrate scheduled idempotent loads.
    """
    logger.info('Ingestion job started')
    try:
        source_url = os.getenv('INGESTION_SOURCE_URL')
        if source_url:
            from ingestion.fetcher import fetch_rate_payload
            from ingestion.parser import parse_http_payload

            payload = fetch_rate_payload(source_url)
            rate, raw = parse_http_payload(payload)
            logger.info(
                'Ingestion job completed via HTTP',
                extra={'parsed': raw.parsed, 'rate_id': getattr(rate, 'id', None)},
            )
        else:
            from ingestion.loader import load_parquet_file

            path = settings.SEED_DATA_PATH
            if not os.path.exists(path):
                logger.error('Seed file not found for scheduled ingestion', extra={'path': path})
                return {'status': 'error', 'detail': 'seed file missing'}

            summary = load_parquet_file(path, batch_size=500)
            logger.info('Ingestion job completed via seed slice', extra=summary)
            return summary
    except Exception as exc:
        logger.error('Ingestion job failed', extra={'error': str(exc)})
        raise self.retry(exc=exc, countdown=60)
