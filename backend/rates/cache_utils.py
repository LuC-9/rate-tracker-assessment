from django.core.cache import cache
import hashlib


LATEST_CACHE_PREFIX = 'rates:latest'
HISTORY_CACHE_PREFIX = 'rates:history'


def latest_cache_key(rate_type=None):
    if rate_type:
        return f'{LATEST_CACHE_PREFIX}:{rate_type}'
    return LATEST_CACHE_PREFIX


def history_cache_key(provider, rate_type, date_from, date_to, page, page_size):
    raw_key = f'{provider}:{rate_type}:{date_from}:{date_to}:{page}:{page_size}'
    digest = hashlib.sha1(raw_key.encode('utf-8')).hexdigest()
    return f'{HISTORY_CACHE_PREFIX}:{digest}'


def invalidate_rate_caches(rate_type=None, provider=None):
    """Invalidate cached latest responses after writes."""
    cache.delete(latest_cache_key())
    if rate_type:
        cache.delete(latest_cache_key(rate_type))
    # History cache keys are short-lived; broad invalidation is acceptable at this scale.
    cache.delete(f'{HISTORY_CACHE_PREFIX}:all')
