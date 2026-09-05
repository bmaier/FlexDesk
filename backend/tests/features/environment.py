"""Behave environment hooks: isolated SQLite DB + FastAPI TestClient per test run."""
import os
import tempfile
from pathlib import Path

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DESKSHARE_DB_PATH"] = _tmp_db.name

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.seed_data import seed  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


def before_all(context):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    context.client = TestClient(app)
    context.client.__enter__()
    context.tokens = {}


def before_scenario(context, scenario):
    context.last_response = None
    context.last_error = None


def after_all(context):
    context.client.__exit__(None, None, None)
    Path(_tmp_db.name).unlink(missing_ok=True)
