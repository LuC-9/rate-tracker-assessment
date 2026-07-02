import uuid

from django.db import models
from django.utils import timezone


class BaseModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


CURRENCY_ALIASES = {
    'US DOLLAR': 'USD',
    'USD': 'USD',
    'EUR': 'EUR',
    'GBP': 'GBP',
}


def normalize_provider_name(provider):
    if not provider:
        return None
    return provider.strip().lower()


def normalize_currency(currency):
    if not currency:
        return 'USD'
    normalized = currency.strip().upper()
    return CURRENCY_ALIASES.get(normalized, normalized)


def is_valid_rate_value(value):
    if value is None:
        return False
    return 0 <= float(value) <= 20


class RawResponse(BaseModel):
    """Stores raw API / seed payloads for replay and auditing."""

    id = models.UUIDField(primary_key=True, editable=False)
    provider = models.CharField(max_length=200)
    rate_type = models.CharField(max_length=200)
    source_url = models.URLField(blank=True, null=True)
    raw_data = models.JSONField()
    parsed = models.BooleanField(default=False)
    parse_error = models.TextField(blank=True)

    class Meta:
        db_table = 'raw_responses'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.provider} - {self.rate_type} - {self.id}'


class Rate(BaseModel):
    """Cleaned rate records derived from raw responses."""

    provider_raw = models.CharField(max_length=200)
    provider_normalized = models.CharField(max_length=100, db_index=True)
    rate_type = models.CharField(max_length=200, db_index=True)
    rate_value = models.DecimalField(max_digits=15, decimal_places=6, null=True, blank=True)
    effective_date = models.DateField(db_index=True)
    ingestion_timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    source_url = models.URLField(blank=True, null=True)
    raw_response = models.OneToOneField(
        RawResponse,
        on_delete=models.CASCADE,
        related_name='rate',
    )
    currency = models.CharField(max_length=10, default='USD', db_index=True)

    class Meta:
        db_table = 'rates'
        indexes = [
            models.Index(fields=['provider_normalized', 'rate_type', '-effective_date'], name='idx_provider_type_date'),
            models.Index(fields=['ingestion_timestamp'], name='idx_ingestion_ts'),
            models.Index(fields=['rate_type', 'effective_date'], name='idx_rate_type_date'),
        ]
        ordering = ['-effective_date', 'provider_normalized']

    def __str__(self):
        return f'{self.provider_normalized} - {self.rate_type} @ {self.effective_date}'

    def save(self, *args, **kwargs):
        self.provider_normalized = normalize_provider_name(self.provider_raw)
        self.currency = normalize_currency(self.currency)
        super().save(*args, **kwargs)

    @classmethod
    def get_latest_per_provider(cls, rate_type=None):
        queryset = cls.objects.all()
        if rate_type:
            queryset = queryset.filter(rate_type=rate_type)
        return (
            queryset.order_by('provider_normalized', 'rate_type', '-effective_date', '-ingestion_timestamp')
            .distinct('provider_normalized', 'rate_type')
        )

    @classmethod
    def get_history(cls, provider, rate_type, start_date=None, end_date=None):
        queryset = cls.objects.filter(
            provider_normalized=normalize_provider_name(provider),
            rate_type=rate_type,
            rate_value__isnull=False,
        )
        if start_date:
            queryset = queryset.filter(effective_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(effective_date__lte=end_date)
        return queryset.order_by('-effective_date', '-ingestion_timestamp')

    @classmethod
    def get_30_day_changes(cls, rate_type):
        from datetime import timedelta

        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        return cls.objects.filter(
            rate_type=rate_type,
            effective_date__gte=thirty_days_ago,
            rate_value__isnull=False,
        ).order_by('provider_normalized', 'effective_date')

    @classmethod
    def ingested_in_window(cls, start_ts, end_ts):
        return cls.objects.filter(
            ingestion_timestamp__gte=start_ts,
            ingestion_timestamp__lt=end_ts,
        ).order_by('-ingestion_timestamp')
