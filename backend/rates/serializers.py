from decimal import Decimal

from rest_framework import serializers

from rates.models import Rate, is_valid_rate_value, normalize_currency, normalize_provider_name


class RateSerializer(serializers.ModelSerializer):
    provider = serializers.CharField(source='provider_normalized', read_only=True)

    class Meta:
        model = Rate
        fields = [
            'id',
            'provider',
            'provider_raw',
            'rate_type',
            'rate_value',
            'effective_date',
            'ingestion_timestamp',
            'currency',
            'source_url',
        ]


class IngestRateSerializer(serializers.Serializer):
    provider = serializers.CharField(max_length=200)
    rate_type = serializers.CharField(max_length=200)
    rate_value = serializers.DecimalField(max_digits=15, decimal_places=6)
    effective_date = serializers.DateField()
    ingestion_timestamp = serializers.DateTimeField(required=False)
    currency = serializers.CharField(max_length=10, required=False, default='USD')
    source_url = serializers.URLField(required=False, allow_blank=True)
    raw_response_id = serializers.UUIDField(required=False)

    def validate_rate_value(self, value):
        if not is_valid_rate_value(value):
            raise serializers.ValidationError('rate_value must be between 0 and 20.')
        return value

    def validate(self, attrs):
        attrs['provider_normalized'] = normalize_provider_name(attrs['provider'])
        attrs['currency'] = normalize_currency(attrs.get('currency', 'USD'))
        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        from ingestion.loader import persist_rate_record

        raw_id = validated_data.pop('raw_response_id', None)
        ingestion_ts = validated_data.pop('ingestion_timestamp', timezone.now())
        provider = validated_data.pop('provider')
        provider_normalized = validated_data.pop('provider_normalized')

        row = {
            'provider': provider,
            'rate_type': validated_data['rate_type'],
            'rate_value': float(validated_data['rate_value']),
            'effective_date': validated_data['effective_date'].isoformat(),
            'ingestion_ts': ingestion_ts.isoformat(),
            'source_url': validated_data.get('source_url') or '',
            'currency': validated_data['currency'],
            'raw_response_id': str(raw_id) if raw_id else None,
        }
        rate, _ = persist_rate_record(row, source='api')
        return rate
