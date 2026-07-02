import logging

from django.conf import settings
from django.core.cache import cache
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rates.authentication import BearerTokenAuthentication
from rates.cache_utils import history_cache_key, invalidate_rate_caches, latest_cache_key
from rates.models import Rate
from rates.permissions import BearerTokenRequired
from rates.serializers import IngestRateSerializer, RateSerializer

logger = logging.getLogger('rates')


class LatestRatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        rate_type = request.query_params.get('type')
        cache_key = latest_cache_key(rate_type)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        queryset = Rate.get_latest_per_provider(rate_type=rate_type)
        data = RateSerializer(queryset, many=True).data
        payload = {'count': len(data), 'results': data}
        if data:
            cache.set(cache_key, payload, settings.CACHE_LATEST_TTL)
        return Response(payload)


class HistoryRatesView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        provider = request.query_params.get('provider')
        rate_type = request.query_params.get('type')
        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')
        try:
            page = int(request.query_params.get('page', 1))
            page_size = int(request.query_params.get('page_size', settings.REST_FRAMEWORK['PAGE_SIZE']))
        except (TypeError, ValueError):
            return Response(
                {'error': {'detail': 'page and page_size must be integers.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if page < 1:
            return Response(
                {'error': {'detail': 'page must be >= 1.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if page_size < 1:
            return Response(
                {'error': {'detail': 'page_size must be >= 1.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        page_size = min(page_size, settings.HISTORY_MAX_PAGE_SIZE)

        if not provider or not rate_type:
            return Response(
                {'error': {'detail': 'Query params provider and type are required.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache_key = history_cache_key(provider, rate_type, date_from, date_to, page, page_size)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        start_date = parse_date(date_from) if date_from else None
        end_date = parse_date(date_to) if date_to else None
        if date_from and not start_date:
            return Response(
                {'error': {'detail': 'Invalid from date. Use YYYY-MM-DD.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if date_to and not end_date:
            return Response(
                {'error': {'detail': 'Invalid to date. Use YYYY-MM-DD.'}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Rate.get_history(provider, rate_type, start_date, end_date)
        total = queryset.count()
        offset = (page - 1) * page_size
        page_qs = queryset[offset : offset + page_size]
        results = RateSerializer(page_qs, many=True).data
        payload = {
            'count': total,
            'page': page,
            'page_size': page_size,
            'results': results,
        }
        if results:
            cache.set(cache_key, payload, settings.CACHE_LATEST_TTL)
        return Response(payload)


class IngestRateView(APIView):
    authentication_classes = [BearerTokenAuthentication]
    permission_classes = [BearerTokenRequired]

    def post(self, request):
        serializer = IngestRateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': serializer.errors, 'status_code': status.HTTP_400_BAD_REQUEST},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rate = serializer.save()
        invalidate_rate_caches(rate_type=rate.rate_type, provider=rate.provider_normalized)
        logger.info(
            'Rate ingested via webhook',
            extra={'provider': rate.provider_normalized, 'rate_type': rate.rate_type},
        )
        return Response(RateSerializer(rate).data, status=status.HTTP_201_CREATED)
