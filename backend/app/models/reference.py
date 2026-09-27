"""Reference & identity tables: roles, departments, labels, users.

Kept in 4NF: every non-key attribute depends on the whole key of its own
table only; many-to-many relations use dedicated junction tables (no
repeating groups, no multi-valued columns).
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))


class Department(Base):
    """Referat / Organisationseinheit (Org-Einheit). Self-referential für die Organisationshierarchie
    (Abteilung -> Referat -> Unterreferat, z.B. "6" -> "6.2" -> "6.2.1")."""

    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    cost_center: Mapped[str] = mapped_column(String(50), default="KST-1000")
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)

    parent = relationship("Department", remote_side=[id])


class Label(Base):
    """Flexible tag (Ausstattung etc.) per FR-23/24/25.

    `applicable_types` grenzt ein, für welche Entitätstypen ein Label sinnvoll zur Auswahl steht
    (Komma-Liste aus: property, building, room, meeting_room, desk) — verhindert z.B., dass
    "Barrierefrei" separat für Liegenschaft UND Raum UND Desk neu angelegt wird, indem ein
    einziges Label mehreren Typen zugeordnet werden kann. Default = alle Typen (Altbestand)."""

    __tablename__ = "labels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    applicable_types: Mapped[str] = mapped_column(String(200), default="property,building,room,meeting_room,desk")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    idm_code: Mapped[str] = mapped_column(String(20), unique=True)  # pseudonymized handle, FR-18
    display_name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(200))
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    cost_center: Mapped[str | None] = mapped_column(String(50), nullable=True)
    home_property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id"), nullable=True)
    home_desk_id: Mapped[int | None] = mapped_column(ForeignKey("desks.id"), nullable=True)
    klarname_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)  # FR-21
    notification_channel: Mapped[str] = mapped_column(String(20), default="inbox")  # FR-29
    security_clearance: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. "Ue2"

    department = relationship("Department")
    roles: Mapped[list["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    preferences: Mapped[list["UserPreference"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    # A role may be scoped to one property (§12 Open Question 20: liegenschaftsskalierte Admin-Ebene)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id"), nullable=True)

    user = relationship("User", back_populates="roles")
    role = relationship("Role")


class UserPreference(Base):
    """Präferenz: hinterlegte gewünschte Label-Kombination (FR-3), ranking not hard filter."""

    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)

    user = relationship("User", back_populates="preferences")
    label = relationship("Label")


class Delegation(Base):
    """Vertretungsberechtigung (FR-11/FR-12)."""

    __tablename__ = "delegations"

    id: Mapped[int] = mapped_column(primary_key=True)
    manager_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    employee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(20))  # 'line_org' | 'self_service'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    manager = relationship("User", foreign_keys=[manager_user_id])
    employee = relationship("User", foreign_keys=[employee_user_id])
