from unittest.mock import Mock, patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from ingestion.parser import parse_http_payload
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
def test_latest_rates_endpoint(client: APIClient):
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
def test_history_requires_params(client: APIClient):
    response = client.get('/rates/history/')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_ingest_requires_bearer_token(client: APIClient, sample_http_payload):
    response = client.post('/rates/ingest/', sample_http_payload, format='json')
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_ingest_with_valid_token(client: APIClient, sample_http_payload, settings):
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {settings.INGEST_API_TOKEN}')
    response = client.post('/rates/ingest/', sample_http_payload, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()['provider'] == 'hsbc'
