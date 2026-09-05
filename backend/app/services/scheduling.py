"""Time-range helpers: day-part resolution (FR-4) and series date expansion (FR-9/10)."""
from __future__ import annotations

from datetime import date, datetime, timedelta

FULL_START_HOUR = 8
FULL_END_HOUR = 18
MAX_SERIES_OCCURRENCES = 60  # PoC guardrail; production would follow the NFR booking horizon


def desk_day_part_range(the_date: date, day_part: str, switch_hour: int) -> tuple[datetime, datetime]:
    if day_part == "am":
        return (
            datetime.combine(the_date, datetime.min.time()).replace(hour=FULL_START_HOUR),
            datetime.combine(the_date, datetime.min.time()).replace(hour=switch_hour),
        )
    if day_part == "pm":
        return (
            datetime.combine(the_date, datetime.min.time()).replace(hour=switch_hour),
            datetime.combine(the_date, datetime.min.time()).replace(hour=FULL_END_HOUR),
        )
    return (
        datetime.combine(the_date, datetime.min.time()).replace(hour=FULL_START_HOUR),
        datetime.combine(the_date, datetime.min.time()).replace(hour=FULL_END_HOUR),
    )


def expand_series_dates(start_date: date, weekdays: list[int], interval: str, end_date: date) -> list[date]:
    """Weekday pattern + interval (weekly/biweekly/monthly) up to end_date, capped for the PoC."""
    dates: list[date] = []
    cursor = start_date
    start_iso_week = start_date.isocalendar()[1]
    while cursor <= end_date and len(dates) < MAX_SERIES_OCCURRENCES:
        if cursor.weekday() in weekdays:
            include = True
            if interval == "biweekly":
                include = cursor.isocalendar()[1] % 2 == start_iso_week % 2
            elif interval == "monthly":
                include = cursor.day <= 7  # first matching weekday occurrence of the month (approximation)
            if include:
                dates.append(cursor)
        cursor += timedelta(days=1)
    return dates
