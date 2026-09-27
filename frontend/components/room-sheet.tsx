"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AnimatePresence, motion } from "motion/react";
import { Bluetooth, Clock, DoorOpen, Nfc, QrCode, UserRound, Users, X } from "lucide-react";
import Sheet from "./sheet";
import { ErrorState, Skeleton, StatusPill, equipmentIcon, useNow } from "./ui";
import { useToast } from "@/app/providers";
import { bookingTitle, useI18n, type I18n } from "@/lib/i18n";
import { ApiError, api, tehranISO, tehranMinutes, tehranToday, type Booking, type RoomDetail, type Source } from "@/lib/api";

const DAY_START = 8 * 60, DAY_END = 20 * 60;
const pos = (m: number) => Math.min(100, Math.max(0, ((m - DAY_START) / (DAY_END - DAY_START)) * 100));
const hhmm = (d: Date) => tehranISO(d).slice(11, 16);

function errorText(i: I18n, e: unknown, conflict: string) {
  if (!(e instanceof ApiError)) return i.t.common.error;
  if (e.status === 0) return i.t.common.network;
  if (e.status === 409) return conflict;
  if (e.status === 422) return i.t.toast.invalid;
  if (e.status === 404) return i.t.room.notFound;
  return i.t.common.error;
}

export default function RoomSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const i = useI18n();
  const { data } = useSWR<RoomDetail>(id ? `/rooms/${id}` : null);
  const name = data?.name[i.locale] ?? "";
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      label={name || i.t.live.rooms}
      header={
        <div className="px-5 pb-4 pe-16 pt-2 md:pt-6">
          {data ? (
            <>
              <h2 className="text-[1.75rem] font-bold leading-tight tracking-tight">{name}</h2>
              <p className="caption mt-1 flex flex-wrap items-center gap-x-2 text-label-2">
                <span>{i.t.kind[data.kind]}</span>·<span>{i.t.common.floor(i.num(data.floor))}</span>·
                <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{i.t.room.capacity(i.num(data.capacity))}</span>
              </p>
            </>
          ) : (
            <Skeleton className="h-16 w-48" />
          )}
        </div>
      }
    >
      {id && <Body id={id} />}
    </Sheet>
  );
}

function Body({ id }: { id: string }) {
  const i = useI18n();
  const { t } = i;
  const toast = useToast();
  const { mutate: mutateAll } = useSWRConfig();
  const { data: room, error, mutate } = useSWR<RoomDetail>(`/rooms/${id}`, { refreshInterval: 10_000 });
  const now = useNow(30_000);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [range, setRange] = useState(() => {
    const d = new Date(Math.ceil(Date.now() / 900_000) * 900_000);
    return { start: hhmm(d), end: hhmm(new Date(d.getTime() + 1_800_000)) };
  });
  const [touched, setTouched] = useState(false);
  const [arrival, setArrival] = useState<null | { phase: "detecting" | "done"; method: Source; action?: string; booking?: Booking }>(null);

  const refresh = () => mutateAll(() => true);

  if (error && !room) return <div className="p-5"><ErrorState onRetry={() => mutate()} /></div>;
  if (!room) return <div className="space-y-3 p-5"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-24" /></div>;

  const run = async (fn: () => Promise<unknown>, ok: string, conflict = t.toast.overlap) => {
    setBusy(true);
    try {
      await fn();
      toast({ kind: "success", text: ok });
      await refresh();
    } catch (e) {
      toast({ kind: "error", text: errorText(i, e, conflict) });
    } finally {
      setBusy(false);
    }
  };

  const book = (start: Date, end: Date) =>
    run(
      () => api("/bookings", { method: "POST", body: { room_id: id, title: title.trim() || t.room.defaultTitle, organizer: organizer.trim() || t.common.you, start: tehranISO(start), end: tehranISO(end) } }),
      t.toast.booked,
    );

  // Inline validation for the custom range
  const s = tehranToday(range.start), e = tehranToday(range.end);
  const rangeError = !range.start || !range.end ? t.validation.required
    : e <= s ? t.validation.endAfterStart
    : e.getTime() - s.getTime() > 8 * 3_600_000 ? t.validation.max8h
    : now && e.getTime() <= now ? t.validation.past : "";

  const simulate = async (method: Source) => {
    setArrival({ phase: "detecting", method });
    const wait = new Promise((r) => setTimeout(r, 1500));
    try {
      const [res] = await Promise.all([api<{ action: string; booking: Booking }>(`/rooms/${id}/checkin`, { method: "POST", body: { method } }), wait]);
      setArrival({ phase: "done", method, ...res });
      navigator.vibrate?.([12, 60, 12]);
      refresh();
      setTimeout(() => setArrival(null), 3400);
    } catch (err) {
      await wait;
      setArrival(null);
      toast({ kind: "error", text: errorText(i, err, t.toast.checkinConflict) });
    }
  };

  const cur = room.current;
  const nowMin = now ? tehranMinutes(new Date(now)) : -1;
  const visible = room.today.filter((b) => b.status !== "released" && b.status !== "no_show");

  return (
    <div className="space-y-4 px-4 pb-8 sm:px-5">
      {/* Status hero */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <StatusPill status={room.status} />
          {room.people > 0 && <span className="caption text-label-2">{t.room.peopleNow(i.num(room.people))}</span>}
        </div>
        <p className="mt-3 text-lg font-semibold">
          {cur ? t.busyUntil(i.time(cur.end)) : room.free_until ? t.freeUntil(i.time(room.free_until)) : t.freeAllDay}
        </p>
        {cur && (
          <div className="mt-3 rounded-2xl bg-card-2 p-3">
            <p className="font-medium">{bookingTitle(i, cur)}</p>
            <p className="caption mt-0.5 flex flex-wrap items-center gap-x-2 text-label-2">
              <span className="tnum">{t.room.until(i.time(cur.start), i.time(cur.end))}</span>·<span>{cur.organizer || t.room.anonymous}</span>·<span>{t.source[cur.source]}</span>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => api(`/rooms/${id}/release`, { method: "POST" }), t.toast.released)}
              className="press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red/12 font-semibold text-red-ink disabled:opacity-50"
            >
              <DoorOpen className="size-4.5" aria-hidden />
              {t.room.release}
            </button>
          </div>
        )}
        {room.equipment.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label={t.live.equipmentLabel}>
            {room.equipment.map((q) => {
              const Icon = equipmentIcon[q];
              return (
                <li key={q} className="flex items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-xs font-medium">
                  <Icon className="size-3.5" aria-hidden />
                  {t.equipment[q]}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Signature moment: presence detection */}
      <div className="card relative overflow-hidden p-4">
        <h3 className="font-semibold">{t.room.arrival}</h3>
        <p className="caption mt-0.5 text-label-2">{t.room.arrivalHint}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([["beacon", Bluetooth], ["qr", QrCode], ["nfc", Nfc]] as const).map(([m, Icon]) => (
            <button
              key={m}
              type="button"
              disabled={!!arrival}
              onClick={() => simulate(m)}
              className="press flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-blue/10 text-sm font-semibold text-blue-ink disabled:opacity-50"
            >
              <Icon className="size-5" aria-hidden />
              {t.source[m]}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {arrival && <Arrival {...arrival} />}
        </AnimatePresence>
      </div>

      {/* Booking */}
      <div className="card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.room.titleLabel}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t.room.titlePlaceholder} className={inputCls} />
          </Field>
          <Field label={t.room.organizer}>
            <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} maxLength={60} placeholder={t.common.you} className={inputCls} />
          </Field>
        </div>
        {room.status !== "busy" && (
          <div>
            <p className="caption mb-2 font-medium text-label-2">{t.room.quickBook} · {t.room.quickBookHint}</p>
            <div className="grid grid-cols-3 gap-2">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => book(new Date(), new Date(Date.now() + m * 60_000))}
                  className="press min-h-11 rounded-xl bg-accent text-sm font-semibold text-white disabled:opacity-50"
                >
                  {t.common.minutes(i.num(m))}
                </button>
              ))}
            </div>
          </div>
        )}
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            setTouched(true);
            if (!rangeError) book(s, e);
          }}
        >
          <p className="caption mb-2 font-medium text-label-2">{t.room.custom}</p>
          <div className="flex items-end gap-2">
            <Field label={t.room.start}>
              <input type="time" dir="ltr" value={range.start} onChange={(ev) => setRange({ ...range, start: ev.target.value })} className={`${inputCls} tnum`} aria-invalid={touched && !!rangeError} />
            </Field>
            <Field label={t.room.end}>
              <input type="time" dir="ltr" value={range.end} onChange={(ev) => setRange({ ...range, end: ev.target.value })} className={`${inputCls} tnum`} aria-invalid={touched && !!rangeError} aria-describedby="range-err" />
            </Field>
            <button type="submit" disabled={busy} className="press min-h-11 shrink-0 rounded-xl bg-fill px-5 font-semibold text-blue-ink disabled:opacity-50">
              {t.room.book}
            </button>
          </div>
          <p id="range-err" role="alert" className="caption mt-1.5 min-h-5 text-red-ink">{touched ? rangeError : ""}</p>
        </form>
      </div>

      {/* Today's timeline */}
      <div className="card p-4">
        <h3 className="mb-3 font-semibold">{t.room.today}</h3>
        <div className="relative h-10 rounded-xl bg-fill" aria-hidden>
          {visible.map((b) => {
            const a = pos(tehranMinutes(b.start)), z = pos(tehranMinutes(b.end));
            const tone = b.status === "active" ? "bg-red" : b.status === "upcoming" ? "bg-blue" : "bg-label-2/40";
            return <span key={b.id} className={`absolute inset-y-1.5 rounded-md ${tone}`} style={{ insetInlineStart: `${a}%`, width: `${Math.max(z - a, 0.8)}%` }} />;
          })}
          {nowMin >= DAY_START && nowMin <= DAY_END && (
            <span className="absolute -inset-y-1 w-0.5 rounded-full bg-orange shadow-[0_0_0_2px_var(--card)]" style={{ insetInlineStart: `${pos(nowMin)}%` }} />
          )}
        </div>
        <div className="caption tnum mt-1 flex justify-between text-label-2" aria-hidden>
          {[8, 11, 14, 17, 20].map((h) => <span key={h}>{i.num(h)}</span>)}
        </div>
        {room.today.length === 0 ? (
          <p className="caption mt-4 text-label-2">{t.room.noBookings}</p>
        ) : (
          <ul className="mt-3 divide-y divide-sep">
            {room.today.map((b) => (
              <li key={b.id} className={`flex items-center gap-3 py-2.5 ${b.status === "released" || b.status === "no_show" || b.status === "ended" ? "opacity-55" : ""}`}>
                <span className="caption tnum w-24 shrink-0 font-medium">{t.room.until(i.time(b.start), i.time(b.end))}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium">{bookingTitle(i, b)}</span>
                  <span className="caption flex items-center gap-1.5 text-label-2">
                    {b.source === "manual" ? <UserRound className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}
                    {b.organizer || t.room.anonymous} · {t.source[b.source]} · {t.bookingStatus[b.status]}
                  </span>
                </span>
                {b.status === "upcoming" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => api(`/bookings/${b.id}`, { method: "DELETE" }), t.toast.cancelled)}
                    aria-label={`${t.room.cancel}: ${bookingTitle(i, b)}`}
                    className="press grid size-11 shrink-0 place-items-center rounded-full text-red-ink hover:bg-red/10 disabled:opacity-50"
                  >
                    <X className="size-4.5" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const inputCls = "min-h-11 w-full rounded-xl bg-fill px-3 text-[1rem] outline-none placeholder:text-label-2/70 focus:ring-2 focus:ring-blue aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="caption mb-1 block font-medium text-label-2">{label}</span>
      {children}
    </label>
  );
}

function Arrival({ phase, method, action, booking }: { phase: "detecting" | "done"; method: Source; action?: string; booking?: Booking }) {
  const i = useI18n();
  const { t } = i;
  const done = phase === "done";
  const Icon = { beacon: Bluetooth, qr: QrCode, nfc: Nfc, manual: Bluetooth }[method];
  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
      className="material absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center"
    >
      <div className="relative grid size-16 place-items-center">
        {!done &&
          [0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="absolute inset-0 rounded-full border-2 border-blue"
              initial={{ scale: 0.6, opacity: 0.7 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 1.5, repeat: Infinity, delay: k * 0.5, ease: "easeOut" }}
            />
          ))}
        <motion.span
          className="relative grid size-16 place-items-center rounded-full text-white"
          animate={{ backgroundColor: done ? "var(--green)" : "var(--blue)", scale: done ? [1, 1.12, 1] : 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
        >
          {done ? (
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.1 }} />
            </svg>
          ) : (
            <Icon className="size-7" aria-hidden />
          )}
        </motion.span>
      </div>
      <div>
        <p className="font-semibold">{done ? t.room.detected : t.room.detecting}</p>
        {done && booking && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="caption mt-0.5 text-label-2">
            {action === "auto_booked" ? t.room.autoBooked : t.room.checkedIn} · <span className="tnum">{t.room.until(i.time(booking.start), i.time(booking.end))}</span>
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
