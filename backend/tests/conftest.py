"""Shared pytest fixtures: isolated SQLite DB per test session + authenticated TestClient helper."""
import os
import tempfile
from pathlib import Path

import pytest

_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DESKSHARE_DB_PATH"] = _tmp_db.name

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.seed_data import seed  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _prepare_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    yield
    Path(_tmp_db.name).unlink(missing_ok=True)


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth_headers(client):
    def _login(user_id: int) -> dict:
        resp = client.post("/api/auth/login", json={"user_id": user_id})
        assert resp.status_code == 200, resp.text
        token = resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}

    return _login


# Well-known demo user ids from app.seed_data (kept in sync manually for test readability)
ALI_YILMAZ = 2
JOHANNES_SCHNEIDER = 3
ELENA_PETROVA = 4
FRAU_KESSLER = 5
FRAU_KAYA = 6
HANS_MUELLER = 7
HERR_DEMIR = 8
FRAU_OSTERMANN = 9
HERR_BRANDT = 10
MARIA_SCHMIDT = 1
