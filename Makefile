.PHONY: up down build seed test logs migrate shell

up:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build

seed:
	docker compose run --rm web /app/scripts/entrypoint.sh seed

test:
	docker compose run --rm -e DJANGO_SETTINGS_MODULE=rate_tracker.settings -e PYTHONPATH=/app/backend web pytest -q /app/backend/tests

logs:
	docker compose logs -f

migrate:
	docker compose run --rm web python manage.py migrate

shell:
	docker compose run --rm web python manage.py shell
