import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Load rates from the seed parquet file into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--path',
            type=str,
            default=None,
            help='Path to rates_seed.parquet (defaults to SEED_DATA_PATH setting)',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=settings.INGESTION_BATCH_SIZE,
            help='Number of rows per batch',
        )

    def handle(self, *args, **options):
        path = options['path'] or settings.SEED_DATA_PATH
        if not os.path.exists(path):
            self.stderr.write(self.style.ERROR(f'Seed file not found: {path}'))
            return

        from ingestion.loader import load_parquet_file

        self.stdout.write(f'Loading seed data from {path}...')
        summary = load_parquet_file(path, batch_size=options['batch_size'])
        self.stdout.write(self.style.SUCCESS(f"Done: {summary}"))
