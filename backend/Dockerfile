FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY rates_seed.parquet /app/rates_seed.parquet
COPY scripts /app/scripts

RUN chmod +x /app/scripts/*.sh

WORKDIR /app/backend

EXPOSE 8000

CMD ["/app/scripts/entrypoint.sh", "web"]
