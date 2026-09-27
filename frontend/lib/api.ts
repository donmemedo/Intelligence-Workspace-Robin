export type Equipment = "video" | "tv" | "whiteboard" | "phone" | "projector";
export type Source = "manual" | "beacon" | "qr" | "nfc";
export type RoomStatus = "free" | "busy" | "soon";

export type Booking = {
  id: number;
  room_id: string;
  title: string;
  organizer: string;
  start: string;
  end: string;
  source: Source;
  checked_in: boolean;
  status: "upcoming" | "active" | "ended" | "released" | "no_show";
};

export type Room = {
  id: string;
  name: { fa: string; en: string };
  floor: number;
  capacity: number;
  kind: "meeting" | "focus" | "board" | "phone";
  equipment: Equipment[];
  x: number;
  y: number;
  w: number;
  h: number;
  status: RoomStatus;
  people: number;
  current: Booking | null;
  next: Booking | null;
  free_until: string | null;
};

export type RoomDetail = Room & { today: Booking[] };

export type Summary = {
  rooms_total: number;
  rooms_free: number;
  occupancy_pct: number;
  meetings_today: number;
  auto_booked_today: number;
  no_shows_today: number;
  minutes_saved_today: number;
  floors: { floor: number; total: number; free: number }[];
};

export type Analytics = {
  range_days: number;
  utilization_pct: number;
  no_show_rate_pct: number;
  auto_booked_pct: number;
  avg_meeting_minutes: number;
  hours_saved: number;
  rooms: { id: string; name: { fa: string; en: string }; floor: number; capacity: number; utilization_pct: number; bookings: number; no_shows: number }[];
  heatmap: { weekday: number; hour: number; pct: number }[];
  daily: { date: string; bookings: number; utilization_pct: number }[];
  underused: string[];
};

export const EQUIPMENT: Equipment[] = ["video", "tv", "whiteboard", "projector", "phone"];

export class ApiError extends Error {
  constructor(public status: number, public detail?: string) {
    super(detail || `HTTP ${status}`);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0);
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const d = (await res.json()).detail;
      detail = typeof d === "string" ? d : undefined;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** ISO-8601 in Asia/Tehran (+03:30, Iran has no DST). */
export function tehranISO(d: Date) {
  const s = new Date(d.getTime() + 3.5 * 3600_000).toISOString().slice(0, 19);
  return s + "+03:30";
}

/** "HH:MM" today in Tehran → Date */
export function tehranToday(hhmm: string, now = new Date()) {
  const ymd = tehranISO(now).slice(0, 10);
  return new Date(`${ymd}T${hhmm}:00+03:30`);
}

/** Minutes since Tehran midnight. */
export function tehranMinutes(d: Date | string) {
  const s = tehranISO(new Date(d));
  return +s.slice(11, 13) * 60 + +s.slice(14, 16);
}
