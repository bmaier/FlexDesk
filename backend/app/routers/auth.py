from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_user_roles, make_token
from app.db import get_db
from app.models.reference import Delegation, Label, User, UserPreference

router = APIRouter(prefix="/api/auth", tags=["auth"])


class DemoUserOut(BaseModel):
    id: int
    idm_code: str
    display_name: str
    department: str | None
    roles: list[str]

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    user_id: int


class LoginResponse(BaseModel):
    token: str
    user: DemoUserOut


def _to_demo_user(user: User, db: Session) -> DemoUserOut:
    roles = sorted(get_user_roles(user, db))
    return DemoUserOut(
        id=user.id,
        idm_code=user.idm_code,
        display_name=user.display_name,
        department=user.department.name if user.department else None,
        roles=roles,
    )


@router.get("/users", response_model=list[DemoUserOut])
def list_demo_users(db: Session = Depends(get_db)):
    """Role-switcher source: every demo account with its role(s), for the login/switch screen."""
    users = db.query(User).order_by(User.id).all()
    return [_to_demo_user(u, db) for u in users]


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Nutzer nicht gefunden."})
    return LoginResponse(token=make_token(user.id), user=_to_demo_user(user, db))


@router.get("/me", response_model=DemoUserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _to_demo_user(user, db)


class DelegationOut(BaseModel):
    employee_id: int
    employee_name: str
    source: str
    home_property_id: int | None


@router.get("/delegations", response_model=list[DelegationOut])
def my_delegations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """People the current user (Team-Assistenz/Manager) may book/cancel for — FR-11/12."""
    rows = db.query(Delegation).filter(Delegation.manager_user_id == user.id).all()
    return [
        DelegationOut(employee_id=r.employee_user_id, employee_name=r.employee.display_name, source=r.source,
                      home_property_id=r.employee.home_property_id)
        for r in rows
    ]


class PreferencesOut(BaseModel):
    label_ids: list[int]
    home_property_id: int | None
    klarname_opt_in: bool
    notification_channel: str


@router.get("/preferences", response_model=PreferencesOut)
def get_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """FR-3/FR-21/FR-1/FR-29 — feste Präferenzen + Konto-Einstellungen, siehe 'Meine Präferenzen'."""
    label_ids = [p.label_id for p in db.query(UserPreference).filter(UserPreference.user_id == user.id)]
    return PreferencesOut(label_ids=label_ids, home_property_id=user.home_property_id,
                           klarname_opt_in=user.klarname_opt_in, notification_channel=user.notification_channel)


class UpdatePreferencesIn(BaseModel):
    label_ids: list[int]


@router.put("/preferences", response_model=PreferencesOut)
def update_preferences(payload: UpdatePreferencesIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(UserPreference).filter(UserPreference.user_id == user.id).delete()
    for label_id in payload.label_ids:
        if db.get(Label, label_id):
            db.add(UserPreference(user_id=user.id, label_id=label_id))
    db.commit()
    return get_preferences(user, db)


class UpdateAccountIn(BaseModel):
    klarname_opt_in: bool | None = None
    notification_channel: str | None = None
    home_property_id: int | None = None


@router.patch("/account", response_model=PreferencesOut)
def update_account(payload: UpdateAccountIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.klarname_opt_in is not None:
        user.klarname_opt_in = payload.klarname_opt_in
    if payload.notification_channel is not None:
        user.notification_channel = payload.notification_channel
    if payload.home_property_id is not None:
        user.home_property_id = payload.home_property_id
    db.commit()
    return get_preferences(user, db)


# --------------------------------------------------------------------------
# Selbstverwaltete Vertretungen: "wer darf in meinem Namen agieren" (FR-11/12,
# Self-Service — nicht nur Team-Assistenz/Linienorganisation, jede Person kann
# eigene Vertreter:innen benennen).
# --------------------------------------------------------------------------

class MyDelegateOut(BaseModel):
    delegation_id: int
    delegate_user_id: int
    delegate_name: str
    source: str


@router.get("/my-delegates", response_model=list[MyDelegateOut])
def my_delegates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Personen, die aktuell in meinem Namen buchen/stornieren dürfen."""
    rows = db.query(Delegation).filter(Delegation.employee_user_id == user.id).all()
    return [
        MyDelegateOut(delegation_id=r.id, delegate_user_id=r.manager_user_id,
                      delegate_name=r.manager.display_name, source=r.source)
        for r in rows
    ]


class AddDelegateIn(BaseModel):
    delegate_user_id: int


@router.post("/my-delegates", response_model=MyDelegateOut)
def add_my_delegate(payload: AddDelegateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.delegate_user_id == user.id:
        raise HTTPException(status_code=400, detail={"code": "SELF_DELEGATION", "message": "Sie können sich nicht selbst als Vertretung eintragen."})
    delegate = db.get(User, payload.delegate_user_id)
    if delegate is None:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Nutzer nicht gefunden."})
    existing = (
        db.query(Delegation)
        .filter(Delegation.employee_user_id == user.id, Delegation.manager_user_id == payload.delegate_user_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail={"code": "ALREADY_DELEGATE", "message": "Diese Person ist bereits als Vertretung hinterlegt."})
    delegation = Delegation(manager_user_id=payload.delegate_user_id, employee_user_id=user.id, source="self_service")
    db.add(delegation)
    db.commit()
    db.refresh(delegation)
    return MyDelegateOut(delegation_id=delegation.id, delegate_user_id=delegate.id,
                          delegate_name=delegate.display_name, source=delegation.source)


@router.delete("/my-delegates/{delegation_id}")
def remove_my_delegate(delegation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    delegation = db.get(Delegation, delegation_id)
    if delegation is None or delegation.employee_user_id != user.id:
        raise HTTPException(status_code=404, detail={"code": "DELEGATION_NOT_FOUND", "message": "Vertretung nicht gefunden."})
    if delegation.source != "self_service":
        raise HTTPException(status_code=403, detail={"code": "NOT_SELF_SERVICE", "message": "Diese Vertretung stammt aus der Linienorganisation und kann hier nicht entfernt werden."})
    db.delete(delegation)
    db.commit()
    return {"ok": True}
