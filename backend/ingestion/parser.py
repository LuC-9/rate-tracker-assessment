import uuid
from typing import Any

from ingestion.loader import persist_rate_record


def parse_http_payload(payload: dict[str, Any]) -> tuple[Any, Any]:
    """
    Parse an HTTP JSON payload into a normalized row dict for persistence.
    """
    row = {
        'provider': payload.get('provider'),
        'rate_type': payload.get('rate_type'),
        'rate_value': payload.get('rate_value'),
        'effective_date': payload.get('effective_date'),
        'ingestion_ts': payload.get('ingestion_timestamp') or payload.get('ingestion_ts'),
        'source_url': payload.get('source_url'),
        'currency': payload.get('currency', 'USD'),
        'raw_response_id': payload.get('raw_response_id') or str(uuid.uuid4()),
    }
    return persist_rate_record(row, source='http')
