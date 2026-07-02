import logging
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger('ingestion')


class IngestionFetcherError(Exception):
    """Raised when an HTTP fetch fails after retries."""


def fetch_rate_payload(url: str, timeout: int | None = None) -> dict[str, Any]:
    """
    Fetch a rate payload from an HTTP endpoint with timeout and error handling.
    """
    timeout = timeout or settings.INGESTION_WORKER_TIMEOUT
    attempts = settings.INGESTION_RETRY_ATTEMPTS
    last_error = None

    for attempt in range(1, attempts + 1):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError('Response JSON must be an object')
            payload.setdefault('source_url', url)
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            logger.warning(
                'HTTP fetch attempt failed',
                extra={'url': url, 'attempt': attempt, 'error': str(exc)},
            )

    raise IngestionFetcherError(f'Failed to fetch {url}: {last_error}')
