"""Simulated authentication for the PoC.

No real IDM/Keycloak integration. The frontend "logs in" by picking a demo
user; the backend issues an opaque bearer token that just encodes the user
id (`demo:<id>`). A dependency resolves the current user + their roles from
the `Authorization: Bearer demo:<id>` header. This is intentionally simple —
see README "Login/Auth" section.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.reference import User, UserRole


def make_token(user_id: int) -> str:
    return f"demo:{user_id}"


def _parse_token(authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"code": "NOT_AUTHENTICATED", "message": "Fehlende Anmeldung."})
    token = authorization.removeprefix("Bearer ")
    if not token.startswith("demo:"):
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "Ungültiges Token."})
    try:
        return int(token.removeprefix("demo:"))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "Ungültiges Token."}) from exc


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    user_id = _parse_token(authorization)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail={"code": "USER_NOT_FOUND", "message": "Nutzer nicht gefunden."})
    return user


def get_user_roles(user: User, db: Session) -> set[str]:
    rows = db.query(UserRole).filter(UserRole.user_id == user.id).all()
    role_codes = set()
    for r in rows:
        role_codes.add(r.role.code)
    return role_codes


def require_roles(*allowed: str):
    def _dependency(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        roles = get_user_roles(user, db)
        if not roles.intersection(allowed):
            raise HTTPException(
                status_code=403,
                detail={"code": "FORBIDDEN", "message": "Für diese Aktion fehlt die erforderliche Rolle."},
            )
        return user

    return _dependency
