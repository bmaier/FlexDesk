"""Structural hierarchy: Liegenschaft -> Gebäude -> Etage -> Raum -> Desk.

FR-22 (verwaltung), FR-41/42 (approval + responsible), FR-44/45 (zones),
FR-46 (access restriction), FR-53/55 (seating options).
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Property(Base):
    """Liegenschaft."""

    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    address: Mapped[str] = mapped_column(String(250))
    lat: Mapped[float] = mapped_column()
    lon: Mapped[float] = mapped_column()
    checkin_required: Mapped[bool] = mapped_column(Boolean, default=False)  # FR-47, opt-in
    checkin_window_minutes: Mapped[int] = mapped_column(Integer, default=60)
    day_part_switch_hour: Mapped[int] = mapped_column(Integer, default=13)  # FR-4, per-Liegenschaft konfigurierbar

    buildings: Mapped[list["Building"]] = relationship(back_populates="property", cascade="all, delete-orphan")


class PropertyLabel(Base):
    __tablename__ = "property_labels"

    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id"), primary_key=True)
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(150))

    property = relationship("Property", back_populates="buildings")
    floors: Mapped[list["Floor"]] = relationship(back_populates="building", cascade="all, delete-orphan")


class BuildingLabel(Base):
    __tablename__ = "building_labels"

    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"), primary_key=True)
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)


class Floor(Base):
    """Etage. Carries the SVG floorplan reference used for FR-2 exploration."""

    __tablename__ = "floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    name: Mapped[str] = mapped_column(String(60))
    floorplan_image_path: Mapped[str | None] = mapped_column(String(300), nullable=True)  # FR-51
    floorplan_layout: Mapped[str | None] = mapped_column(String(20000), nullable=True)

    building = relationship("Building", back_populates="floors")
    rooms: Mapped[list["Room"]] = relationship(back_populates="floor", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id"))
    room_number: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(150))
    room_type: Mapped[str] = mapped_column(String(20))  # 'meeting' | 'desk_area'
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)  # FR-41
    restricted_role_code: Mapped[str | None] = mapped_column(String(40), nullable=True)  # FR-46
    checkin_required: Mapped[bool] = mapped_column(Boolean, default=False)  # Raum-Override zu FR-47
    pos_x: Mapped[float | None] = mapped_column(nullable=True)  # SVG position on floorplan
    pos_y: Mapped[float | None] = mapped_column(nullable=True)
    width: Mapped[float | None] = mapped_column(nullable=True)
    height: Mapped[float | None] = mapped_column(nullable=True)
    floorplan_layout: Mapped[str | None] = mapped_column(String(20000), nullable=True)
    seating_layout: Mapped[str | None] = mapped_column(String(50), nullable=True, default="boardroom")
    slot_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_start_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    day_end_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)

    floor = relationship("Floor", back_populates="rooms")
    desks: Mapped[list["Desk"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class RoomLabel(Base):
    __tablename__ = "room_labels"

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)


class RoomDepartment(Base):
    """Org-Einheiten-Zuordnung eines Raums (statt/zusätzlich zu restricted_role_code), mit
    konfigurierbarer Hierarchie-Kaskade: include_descendants=True (Default) gewährt auch allen
    untergeordneten Org-Einheiten Zugriff, False beschränkt exakt auf die zugeordnete Einheit."""

    __tablename__ = "room_departments"

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), primary_key=True)
    include_descendants: Mapped[bool] = mapped_column(Boolean, default=True)


class RoomResponsible(Base):
    """Raumverantwortlicher, FR-42 (many responsibles possible)."""

    __tablename__ = "room_responsibles"

    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)


class SeatingOption(Base):
    """Bestuhlungsoption, FR-53/55."""

    __tablename__ = "seating_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    name: Mapped[str] = mapped_column(String(100))
    is_standard: Mapped[bool] = mapped_column(Boolean, default=False)
    changeover_days: Mapped[int] = mapped_column(Integer, default=0)  # FR-54


class Desk(Base):
    __tablename__ = "desks"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    desk_number: Mapped[str] = mapped_column(String(30))
    pos_x: Mapped[float | None] = mapped_column(nullable=True)
    pos_y: Mapped[float | None] = mapped_column(nullable=True)
    approval_required: Mapped[bool] = mapped_column(Boolean, default=False)  # per-desk override
    checkin_required: Mapped[bool] = mapped_column(Boolean, default=False)  # Desk-Override zu FR-47

    room = relationship("Room", back_populates="desks")


class DeskLabel(Base):
    __tablename__ = "desk_labels"

    desk_id: Mapped[int] = mapped_column(ForeignKey("desks.id"), primary_key=True)
    label_id: Mapped[int] = mapped_column(ForeignKey("labels.id"), primary_key=True)


class Zone(Base):
    """Referatsbezogenes Raumkontingent, FR-44/45."""

    __tablename__ = "zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id"))
    name: Mapped[str] = mapped_column(String(150))


class ZoneDepartment(Base):
    __tablename__ = "zone_departments"

    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), primary_key=True)
    include_descendants: Mapped[bool] = mapped_column(Boolean, default=True)


class ZoneDesk(Base):
    __tablename__ = "zone_desks"

    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id"), primary_key=True)
    desk_id: Mapped[int] = mapped_column(ForeignKey("desks.id"), primary_key=True)


class SystemSetting(Base):
    """Globale Konfigurationen (z. B. Meetingraum-Slot-Dauer, Tag-Beginn/Ende)."""

    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500))
