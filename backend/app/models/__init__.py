"""Import all model modules so Base.metadata is fully populated."""
from app.models.reference import (  # noqa: F401
    Delegation,
    Department,
    Label,
    Role,
    User,
    UserPreference,
    UserRole,
)
from app.models.structure import (  # noqa: F401
    Building,
    BuildingLabel,
    Desk,
    DeskLabel,
    Floor,
    Property,
    PropertyLabel,
    Room,
    RoomDepartment,
    RoomLabel,
    RoomResponsible,
    SeatingOption,
    Zone,
    ZoneDepartment,
    ZoneDesk,
)
from app.models.bookings import (  # noqa: F401
    Approval,
    Booking,
    BookingAudit,
    BookingSeries,
    CheckIn,
    DefectReport,
    DeskBooking,
    Notification,
    RoomBooking,
    SeriesWeekday,
)
from app.models.locks import (  # noqa: F401
    ConfidentialAuditLog,
    ConfidentialBlock,
    ConfidentialBlockFeature,
    DeskLock,
    Lock,
    PropertyLock,
    RoomLock,
)
