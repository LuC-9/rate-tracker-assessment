import pytest


@pytest.fixture
def sample_http_payload():
    return {
        'provider': 'HSBC',
        'rate_type': '30yr_fixed_mortgage',
        'rate_value': 6.25,
        'effective_date': '2025-01-15',
        'ingestion_timestamp': '2025-01-15T10:00:00Z',
        'currency': 'USD',
        'source_url': 'https://example.com/rates/hsbc',
        'raw_response_id': '11111111-1111-1111-1111-111111111111',
    }
