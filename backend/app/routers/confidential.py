from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_user_roles
from app.db import get_db
from app.models.locks import ConfidentialAuditLog, ConfidentialBlock, ConfidentialBlockFeature
from app.models.reference import User
from app.routers.bookings import _err
from app.services.availability import room_conflicts

router = APIRouter(prefix="/api/confidential", tags=["confidential"])


class CreateBlockIn(BaseModel):
    room_id: int
    start_at: datetime
    end_at: datetime
    category: str
    justification: str
    features: list[str] = []
    file_reference: str | None = None


class BlockOut(BaseModel):
    id: int
    room_id: int
    start_at: datetime
    end_at: datetime
    category: str
    status: str
    features: list[str]


@router.post("", response_model=BlockOut)
def create_block(payload: CreateBlockIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """FR-16/17: kein Freigabeprozess, aber Pflicht-Audit-Log; max. 72h am Stück (UX-Hinweistext)."""
    if "vsnfd" not in get_user_roles(user, db):
        _err(403, "NOT_AUTHORIZED", "Nur Mitarbeitende mit vertraulicher Aufgabe dürfen Räume blockieren.")
    if not payload.justification.strip():
        _err(400, "JUSTIFICATION_REQUIRED", "Eine Begründung ist zwingend erforderlich.")
    duration_hours = (payload.end_at - payload.start_at).total_seconds() / 3600
    if duration_hours > 72:
        _err(400, "MAX_DURATION_EXCEEDED", "Eine Blockierung darf maximal 72 Stunden am Stück dauern.")
    if room_conflicts(db, payload.room_id, payload.start_at, payload.end_at):
        _err(409, "ROOM_ALREADY_BLOCKED", "Der Raum ist im gewählten Zeitraum bereits belegt oder blockiert.")

    block = ConfidentialBlock(room_id=payload.room_id, start_at=payload.start_at, end_at=payload.end_at,
                              category=payload.category, justification=payload.justification,
                              file_reference=payload.file_reference, requested_by_user_id=user.id, status="active")
    db.add(block)
    db.flush()
    for f in payload.features:
        db.add(ConfidentialBlockFeature(block_id=block.id, feature_name=f))
    db.add(ConfidentialAuditLog(block_id=block.id, actor_user_id=user.id, action="requested",
                                 details=f"Raum {payload.room_id} blockiert: {payload.justification}"))
    db.commit()
    db.refresh(block)
    return BlockOut(id=block.id, room_id=block.room_id, start_at=block.start_at, end_at=block.end_at,
                     category=block.category, status=block.status, features=payload.features)


class AuditLogOut(BaseModel):
    id: int
    actor_name: str
    action: str
    details: str
    timestamp: datetime


@router.get("/audit-log", response_model=list[AuditLogOut])
def audit_log(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Zugriffsbeschränkt: nur vsnfd/fm-Rolle (Platzhalter für 'Geheimschutzbeauftragter', §12 Open Q3)."""
    roles = get_user_roles(user, db)
    if not roles.intersection({"vsnfd", "fm"}):
        _err(403, "NOT_AUTHORIZED", "Kein Zugriff auf das vertrauliche Audit-Log.")
    rows = db.query(ConfidentialAuditLog).order_by(ConfidentialAuditLog.timestamp.desc()).all()
    return [
        AuditLogOut(id=r.id, actor_name=db.get(User, r.actor_user_id).display_name, action=r.action,
                    details=r.details, timestamp=r.timestamp)
        for r in rows
    ]
