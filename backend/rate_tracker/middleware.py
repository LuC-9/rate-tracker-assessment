import logging
import time

from django.db import connection

logger = logging.getLogger('rates')


class SlowQueryLoggingMiddleware:
    """Log warnings for database queries exceeding 200ms."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = (time.monotonic() - start) * 1000
        if elapsed_ms > 200:
            logger.warning(
                'Slow request',
                extra={
                    'path': request.path,
                    'method': request.method,
                    'duration_ms': round(elapsed_ms, 2),
                    'query_count': len(connection.queries),
                },
            )
        return response
