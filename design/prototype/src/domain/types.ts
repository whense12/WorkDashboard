/* 명세 §7 데이터 모델 그대로. 날짜는 'YYYY-MM-DD' 로컬 문자열, 시각은 'HH:mm'. */
export type LocalDate = string;  // 'YYYY-MM-DD' (Asia/Seoul)
export type ISOWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=월 … 7=일

export type EventStatus = "confirmed" | "needs_confirmation" | "cancelled";
export type VendorStatus = "confirmed" | "needs_confirmation" | "cancelled";
export type PlanStatus = "confirmed" | "needs_confirmation";
export type TaskStatus = "confirmed" | "needs_confirmation" | "done" | "cancelled";
export type TaskCategory = "office" | "vendor";

export interface Event {
  id: string; name: string; start_date: LocalDate; end_date: LocalDate;
  location: string; status: EventStatus; notes?: string;
}
export interface Vendor {
  id: string; name: string; contact_name: string; contact_phone: string;
  products: string[]; status: VendorStatus; notes?: string;
}
export interface ParticipationPlan {
  id: string; event_id: string; vendor_id: string;
  start_date: LocalDate; end_date: LocalDate; weekdays: ISOWeekday[]; status: PlanStatus;
}
export interface ParticipationException {
  id: string; participation_plan_id: string; date: LocalDate;
  type: "include" | "exclude"; reason: string;
}
export interface Task {
  id: string; title: string; date: LocalDate; time?: string; // 'HH:mm', 없으면 종일
  category: TaskCategory; event_id: string | null; vendor_id: string | null;
  status: TaskStatus; notes?: string;
}
export interface Attachment {
  id: string; owner_type: "vendor" | "event" | "task"; owner_id: string;
  file_path: string; filename: string; file_size: number; added_at: string; missing?: boolean;
}
export interface AuditLog {
  id: string; timestamp: string; entity_type: string; entity_id: string;
  action: string; previous_value: string; new_value: string; actor: string;
}
export interface Backup { id: string; taken_at: string; size_bytes: number; label: string; }

export interface DB {
  events: Event[]; vendors: Vendor[]; plans: ParticipationPlan[];
  exceptions: ParticipationException[]; tasks: Task[];
  attachments: Attachment[]; audit: AuditLog[]; backups: Backup[];
}
