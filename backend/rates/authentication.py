import os

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class BearerTokenAuthentication(BaseAuthentication):
    """Authenticate webhook ingest requests via Bearer token."""

    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith(f'{self.keyword} '):
            return None

        token = auth_header[len(self.keyword) + 1 :].strip()
        expected = os.getenv('INGEST_API_TOKEN', '')
        if not expected:
            raise AuthenticationFailed('INGEST_API_TOKEN is not configured.')
        if token != expected:
            raise AuthenticationFailed('Invalid bearer token.')
        return (None, token)

    def authenticate_header(self, request):
        return self.keyword
