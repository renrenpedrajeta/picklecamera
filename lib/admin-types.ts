export type Court = {
  id: string;
  name: string;
  location: string;
  active: boolean;
};
export type Recorder = {
  id: string;
  name: string;
  last_seen_at: string | null;
};
export type Camera = {
  id: string;
  name: string;
  recorder_id: string;
  court_id: string | null;
  source_type: "network" | "usb";
  device_reference: string;
  is_primary: boolean;
  enabled: boolean;
  health: string;
};
export type Settings = {
  max_duration_seconds: number;
  retention_seconds: number;
  venue_time_zone: string | null;
};
export type Session = {
  id: string;
  court_id: string;
  status: string;
  recipient_email: string;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  stop_reason: string | null;
  failure_stage: string | null;
};
export type Audit = { id: number; action: string; created_at: string };
export type AdminData = {
  courts: Court[];
  cameras: Camera[];
  recorders: Recorder[];
  settings: Settings;
  sessions: Session[];
  events: Audit[];
};
