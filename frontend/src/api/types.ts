export interface DemoUser {
  id: number;
  idm_code: string;
  display_name: string;
  department: string | null;
  roles: string[];
}

export interface Delegation {
  employee_id: number;
  employee_name: string;
  source: string;
  home_property_id: number | null;
}

export interface PropertyOut {
  id: number;
  name: string;
  address: string;
  lat: number;
  lon: number;
  checkin_required: boolean;
  total_desks: number;
  free_desks: number;
  occupancy_pct: number;
  building_count: number;
  labels: string[];
}

export interface DeskNode {
  id: number;
  desk_number: string;
  labels: string[];
  approval_required: boolean;
  checkin_required: boolean;
}

export interface RoomNode {
  id: number;
  room_number: string;
  name: string;
  room_type: "meeting" | "desk_area";
  capacity: number | null;
  approval_required: boolean;
  restricted_role_code: string | null;
  checkin_required: boolean;
  labels: string[];
  desks: DeskNode[];
}

export interface FloorNode {
  id: number;
  name: string;
  floorplan_image_path: string | null;
  floorplan_layout: string | null;
  rooms: RoomNode[];
}

export interface BuildingNode {
  id: number;
  name: string;
  labels: string[];
  floors: FloorNode[];
}

export interface PropertyTree {
  id: number;
  name: string;
  address: string;
  labels: string[];
  buildings: BuildingNode[];
}

export interface LabelOut {
  id: number;
  name: string;
  applicable_types: string[];
}

export interface QuickDeskOut {
  desk_id: number;
  desk_number: string;
  room_name: string;
  property_name: string;
  score: number;
  labels: string[];
}

export interface QuickSuggestionOut {
  home_desk: QuickDeskOut | null;
  home_desk_available: boolean;
  recommendations: QuickDeskOut[];
}

export interface FloorDeskStatus {
  desk_id: number;
  desk_number: string;
  room_id: number;
  room_name: string;
  pos_x: number | null;
  pos_y: number | null;
  status: "available" | "occupied" | "locked" | "zone_restricted" | "top_match" | "mine";
  zone_name: string | null;
  match_score: number;
  labels: string[];
  own_booking_id: number | null;
}

export interface BookingOut {
  id: number;
  kind: "desk" | "room";
  status: "confirmed" | "pending_approval" | "rejected" | "cancelled";
  start_at: string;
  end_at: string;
  booked_for_user_id: number;
  booked_for_name: string;
  booked_by_user_id: number;
  booked_by_name: string;
  resource_label: string;
  property_name: string | null;
  property_id: number | null;
  floor_id: number | null;
  room_id: number | null;
  desk_id: number | null;
  labels: string[];
  series_id: number | null;
  cancel_reason: string | null;
  remark: string | null;
  double_booking_reason: string | null;
  checkin_status: string | null;
  checkin_deadline: string | null;
}

export interface SeriesOccurrencePreview {
  date: string;
  resource_id: number;
  resource_label: string;
  labels: string[];
  available: boolean;
  conflict_reason: string | null;
}

export interface SeriesPreviewOut {
  occurrences: SeriesOccurrencePreview[];
}

export interface SeriesConflict {
  date: string;
  reason: string;
  alternative_desk_id: number | null;
  alternative_desk_number: string | null;
}

export interface SeriesResultOut {
  series_id: number;
  total_attempted: number;
  booked: number;
  conflicts: SeriesConflict[];
  booking_ids: number[];
}

export interface BulkCancelResult {
  cancelled_ids: number[];
  failed: { id: number; reason: string }[];
}

export interface MyDelegateOut {
  delegation_id: number;
  delegate_user_id: number;
  delegate_name: string;
  source: string;
}

export interface ApprovalQueueItem {
  booking_id: number;
  requester_name: string;
  requester_department: string | null;
  resource_label: string;
  start_at: string;
  end_at: string;
  created_at: string;
  remark: string | null;
}

export interface NotificationOut {
  id: number;
  type: string;
  message: string;
  related_booking_id: number | null;
  created_at: string;
  read: boolean;
}

export interface PresenceEntry {
  booking_id: number;
  desk_id: number;
  desk_number: string;
  room_name: string;
  building_name: string;
  property_name: string;
  pos_x: number | null;
  pos_y: number | null;
  idm_code: string;
  display_name: string | null;
  department: string | null;
}

export interface SearchResult {
  type: "room" | "desk" | "user";
  id: number;
  label: string;
  sublabel: string | null;
}

export interface ZoneOut {
  id: number;
  name: string;
  property_id: number;
  departments: string[];
  desk_count: number;
}

export interface DepartmentOut {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
}

export interface RoomDepartmentOut {
  department_id: number;
  department_name: string;
  department_code: string;
  include_descendants: boolean;
}

export interface RoleOut {
  id: number;
  code: string;
  name: string;
}

export interface LabelUsage {
  id: number;
  name: string;
  usage_count: number;
  applicable_types: string[];
}

export interface LabelSuggestion {
  label_id: number;
  label_name: string;
  similarity: number;
}

export interface OccupancyOut {
  property_id: number;
  property_name: string;
  total_desks: number;
  booked_today: number | string;
  occupancy_pct: number | string;
}

export interface SeatingOptionOut {
  id: number;
  name: string;
  is_standard: boolean;
  changeover_days: number;
}

export interface DefectOut {
  id: number;
  entity_kind: string;
  desk_id: number | null;
  room_id: number | null;
  description: string;
  status: string;
  reported_by: string;
  created_at: string;
}
