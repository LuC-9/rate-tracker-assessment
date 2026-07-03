#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until python -c "import psycopg2; psycopg2.connect(dbname='${DB_NAME}', user='${DB_USER}', password='${DB_PASSWORD}', host='${DB_HOST}')" 2>/dev/null; do
  sleep 1
done

echo "Waiting for Redis..."
until python -c "import redis; redis.from_url('${REDIS_URL}').ping()" 2>/dev/null; do
  sleep 1
done

python manage.py migrate --noinput

if [ "${SEED_ON_STARTUP}" = "true" ]; then
  COUNT=$(python manage.py shell -c "from rates.models import Rate; print(Rate.objects.count())")
  if [ "$COUNT" = "0" ]; then
    echo "Seeding database in background..."
    python manage.py seed_data &
  fi
fi
