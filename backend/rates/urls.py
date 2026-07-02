from django.urls import path

from rates.views import HistoryRatesView, IngestRateView, LatestRatesView

urlpatterns = [
    path('latest', LatestRatesView.as_view(), name='rates-latest'),
    path('history', HistoryRatesView.as_view(), name='rates-history'),
    path('ingest', IngestRateView.as_view(), name='rates-ingest'),
]
