#!/bin/sh
set -e

. /app/scripts/wait-for-services.sh

case "$1" in
  web)
    exec gunicorn rate_tracker.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120
    ;;
  celery)
    exec celery -A rate_tracker worker -l info
    ;;
  beat)
    exec celery -A rate_tracker beat -l info
    ;;
  seed)
    exec python manage.py seed_data
    ;;
  test)
    export DJANGO_SETTINGS_MODULE=rate_tracker.settings
    export PYTHONPATH=/app/backend
    exec pytest -q /app/backend/tests
    ;;
  *)
    exec "$@"
    ;;
esac
