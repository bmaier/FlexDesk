"""Desk4Me — PoC FastAPI entrypoint.

Wires up all routers, static floorplan files, CORS for the Vite dev server,
DB creation + seed on first boot, and a lightweight background sweep for
check-in deadlines (FR-48) and upcoming-booking reminders (FR-49).
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db import Base, SessionLocal, engine, migrate_sqlite_schema
from app.models.bookings import Booking, BookingAudit, CheckIn, Notification
from app.routers import approvals, auth, bookings, catalog, confidential, fm, notifications, presence, search
from app.seed_data import seed
from app.services.notifications import notify

CHECKIN_SWEEP_INTERVAL_SECONDS = 15
REMINDER_WINDOW_MINUTES = 30


def _run_sweep_once() -> None:
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # FR-48: verpasster Check-in -> automatische Stornierung + Benachrichtigung
        pending = db.query(CheckIn).filter(CheckIn.status == "pending", CheckIn.deadline_at < now).all()
        for ci in pending:
            booking = db.get(Booking, ci.booking_id)
            if booking and booking.status == "confirmed":
                booking.status = "cancelled"
                booking.cancel_kind = "checkin_missed"
                booking.cancel_reason = "Kein Check-in innerhalb des Zeitfensters"
                db.add(BookingAudit(booking_id=booking.id, actor_user_id=booking.booked_for_user_id, action="checkin_missed"))
                notify(db, booking.booked_for_user_id, "checkin_missed",
                       "Buchung automatisch storniert — kein Check-in.", related_booking_id=booking.id)
            ci.status = "missed"

        # FR-49: proaktive Erinnerung vor Buchungsbeginn (feste Vorlaufzeit für den PoC)
        window_end = now + timedelta(minutes=REMINDER_WINDOW_MINUTES)
        upcoming = (
            db.query(Booking)
            .filter(Booking.status == "confirmed", Booking.start_at > now, Booking.start_at <= window_end)
            .all()
        )
        for b in upcoming:
            already = (
                db.query(Notification)
                .filter(Notification.related_booking_id == b.id, Notification.type == "reminder")
                .first()
            )
            if not already:
                notify(db, b.booked_for_user_id, "reminder",
                       f"Erinnerung: Ihre Buchung beginnt um {b.start_at.strftime('%H:%M')} Uhr.",
                       related_booking_id=b.id)
        db.commit()
    finally:
        db.close()


async def _sweep_loop() -> None:
    while True:
        try:
            _run_sweep_once()
        except Exception:  # pragma: no cover - defensive background loop
            pass
        await asyncio.sleep(CHECKIN_SWEEP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_sqlite_schema()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
    task = asyncio.create_task(_sweep_loop())
    yield
    task.cancel()


app = FastAPI(title="Desk4Me — PoC API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5183", "http://127.0.0.1:5183"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(Path(__file__).resolve().parent / "static")), name="static")

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(bookings.router)
app.include_router(approvals.router)
app.include_router(fm.router)
app.include_router(confidential.router)
app.include_router(notifications.router)
app.include_router(presence.router)
app.include_router(search.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
