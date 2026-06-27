from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import settings


def get_connection() -> Any:
    return psycopg.connect(settings.postgres_dsn, row_factory=dict_row)
