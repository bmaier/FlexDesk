from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models.reference import User
from app.models.structure import Desk, Room

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchResult(BaseModel):
    type: str  # room | desk | user
    id: int
    label: str
    sublabel: str | None


@router.get("", response_model=list[SearchResult])
def search(q: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not q or len(q) < 2:
        return []
    ql = q.lower()
    results: list[SearchResult] = []
    for r in db.query(Room).all():
        if ql in r.name.lower() or ql in r.room_number.lower():
            results.append(SearchResult(type="room", id=r.id, label=r.name, sublabel=f"Raum {r.room_number}"))
    for d in db.query(Desk).all():
        if ql in d.desk_number.lower():
            room = db.get(Room, d.room_id)
            results.append(SearchResult(type="desk", id=d.id, label=d.desk_number, sublabel=room.name))
    for u in db.query(User).all():
        if ql in u.display_name.lower() or ql in u.idm_code.lower():
            results.append(SearchResult(type="user", id=u.id, label=u.idm_code,
                                         sublabel=u.display_name if u.klarname_opt_in else None))
    return results[:30]
