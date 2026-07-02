from unittest.mock import Mock, patch

import pytest
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient
from ingestion.parser import parse_http_payload
from rates.cache_utils import latest_cache_key
from rates.models import Rate, RawResponse


@pytest.mark.django_db
def test_parse_http_payload_persists_rate(sample_http_payload):
    rate, raw = parse_http_payload(sample_http_payload)

    assert raw.parsed is True
    assert rate.provider_normalized == 'hsbc'
    assert float(rate.rate_value) == 6.25
    assert rate.rate_type == '30yr_fixed_mortgage'


@pytest.mark.django_db
@patch('ingestion.fetcher.requests.get')
def test_fetch_rate_payload_success(mock_get, sample_http_payload):
    from ingestion.fetcher import fetch_rate_payload

    mock_response = Mock()
    mock_response.raise_for_status = Mock()
    mock_response.json.return_value = sample_http_payload
    mock_get.return_value = mock_response

    payload = fetch_rate_payload('https://example.com/rates/hsbc')

    assert payload['provider'] == 'HSBC'
    mock_get.assert_called_once()


@pytest.mark.django_db
def test_latest_rates_endpoint():
    client = APIClient()
    raw = RawResponse.objects.create(
        id='22222222-2222-2222-2222-222222222222',
        provider='Barclays',
        rate_type='savings_easy_access',
        raw_data={'provider': 'Barclays'},
        parsed=True,
    )
    Rate.objects.create(
        provider_raw='Barclays',
        provider_normalized='barclays',
        rate_type='savings_easy_access',
        rate_value=4.5,
        effective_date='2025-06-01',
        raw_response=raw,
    )

    response = client.get('/rates/latest/?type=savings_easy_access')
    assert response.status_code == status.HTTP_200_OK
    assert response.json()['count'] >= 1


@pytest.mark.django_db
def test_history_requires_params():
    client = APIClient()
    response = client.get('/rates/history/')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_health_endpoint():
    client = APIClient()
    response = client.get('/health/')
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {'status': 'ok'}


@pytest.mark.django_db
def test_latest_rates_uses_cache():
    client = APIClient()
    raw = RawResponse.objects.create(
        id='33333333-3333-3333-3333-333333333333',
        provider='Barclays',
        rate_type='savings_easy_access',
        raw_data={'provider': 'Barclays'},
        parsed=True,
    )
    Rate.objects.create(
        provider_raw='Barclays',
        provider_normalized='barclays',
        rate_type='savings_easy_access',
        rate_value=4.75,
        effective_date='2025-06-02',
        raw_response=raw,
    )

    cache.clear()
    first_response = client.get('/rates/latest/?type=savings_easy_access')
    assert first_response.status_code == status.HTTP_200_OK
    assert cache.get(latest_cache_key('savings_easy_access')) is not None

    with patch('rates.views.Rate.get_latest_per_provider') as mock_get_latest:
        second_response = client.get('/rates/latest/?type=savings_easy_access')
        assert second_response.status_code == status.HTTP_200_OK
        mock_get_latest.assert_not_called()
    assert second_response.json() == first_response.json()


@pytest.mark.django_db
def test_history_pagination():
    client = APIClient()
    provider = 'Barclays'
    provider_normalized = 'barclays'
    rate_type = 'savings_easy_access'

    for idx, date in enumerate(['2025-06-03', '2025-06-02', '2025-06-01'], start=1):
        raw = RawResponse.objects.create(
            id=f'00000000-0000-0000-0000-00000000000{idx}',
            provider=provider,
            rate_type=rate_type,
            raw_data={'provider': provider},
            parsed=True,
        )
        Rate.objects.create(
            provider_raw=provider,
            provider_normalized=provider_normalized,
            rate_type=rate_type,
            rate_value=4.0 + idx,
            effective_date=date,
            raw_response=raw,
        )

    response = client.get('/rates/history/?provider=Barclays&type=savings_easy_access&page=2&page_size=2')
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload['count'] == 3
    assert payload['page'] == 2
    assert payload['page_size'] == 2
    assert len(payload['results']) == 1


@pytest.mark.django_db
def test_history_rejects_invalid_page_params():
    client = APIClient()
    response = client.get('/rates/history/?provider=hsbc&type=30yr_fixed_mortgage&page=abc&page_size=2')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_ingest_requires_bearer_token(sample_http_payload):
    client = APIClient()
    response = client.post('/rates/ingest/', sample_http_payload, format='json')
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_ingest_with_valid_token(sample_http_payload, settings):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {settings.INGEST_API_TOKEN}')
    response = client.post('/rates/ingest/', sample_http_payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()['provider'] == 'hsbc'


@pytest.mark.django_db
def test_ingest_idempotent_for_same_raw_response_id(sample_http_payload, settings):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {settings.INGEST_API_TOKEN}')

    first = client.post('/rates/ingest/', sample_http_payload, format='json')
    assert first.status_code == status.HTTP_201_CREATED
    assert Rate.objects.count() == 1
    assert RawResponse.objects.count() == 1

    updated_payload = dict(sample_http_payload)
    updated_payload['rate_value'] = 5.75
    second = client.post('/rates/ingest/', updated_payload, format='json')
    assert second.status_code == status.HTTP_201_CREATED
    assert Rate.objects.count() == 1
    assert RawResponse.objects.count() == 1
    assert float(Rate.objects.get().rate_value) == 5.75


@pytest.mark.django_db
def test_ingest_validation_rejects_out_of_range_rate(sample_http_payload, settings):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {settings.INGEST_API_TOKEN}')

    invalid_payload = dict(sample_http_payload)
    invalid_payload['rate_value'] = 50
    response = client.post('/rates/ingest/', invalid_payload, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert 'rate_value' in response.json()['error']
