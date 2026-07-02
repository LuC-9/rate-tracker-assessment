from rest_framework.permissions import BasePermission


class BearerTokenRequired(BasePermission):
    message = 'Bearer token required.'

    def has_permission(self, request, view):
        return bool(getattr(request, 'auth', None))
