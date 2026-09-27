"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { CalendarCheck, Clock, DoorOpen, Gauge, Search, Sparkles, Timer, Users } from "lucide-react";
import FloorPlan from "@/components/floor-plan";
import RoomSheet from "@/components/room-sheet";
import { Chip, ErrorState, Kpi, Section, Segmented, Skeleton, StatusPill, equipmentIcon, statusTone, useNow } from "@/components/ui";
import { bookingTitle, useI18n } from "@/lib/i18n";
import { EQUIPMENT, type Equipment, type Room, type Summary } from "@/lib/api";

const CAPS = [2, 4, 8, 12];

export default function Live() {
  const i = useI18n();
  const { t } = i;
  const rooms = useSWR<Room[]>("/rooms");
  const summary = useSWR<Summary>("/summary");
  const now = useNow();
  const [floor, setFloor] = useState(1);
  const [q, setQ] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [cap, setCap] = useState(0);
  const [equip, setEquip] = useState<Equipment[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);

  const match = useCallback(
    (r: Room) =>
      (!freeOnly || r.status !== "busy") &&
      r.capacity >= cap &&
      equip.every((e) => r.equipment.includes(e)) &&
      (!q.trim() || `${r.name.fa} ${r.name.en}`.toLowerCase().includes(q.trim().toLowerCase())),
    [freeOnly, cap, equip, q],
  );
  const list = useMemo(() => (rooms.data ?? []).filter(match).sort((a, b) => a.floor - b.floor || a.name.en.localeCompare(b.name.en)), [rooms.data, match]);
  const onFloor = (rooms.data ?? []).filter((r) => r.floor === floor);
  const happening = onFloor.filter((r) => r.status !== "free").sort((a, b) => (a.status === "busy" ? -1 : 1) - (b.status === "busy" ? -1 : 1));
  const filtered = freeOnly || cap > 0 || equip.length > 0 || q.trim() !== "";
  const s = summary.data;

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <p className="caption flex items-center gap-2 font-semibold text-green-ink">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-green opacity-60" />
              <span className="relative size-2 rounded-full bg-green" />
            </span>
            {t.live.badge}
          </p>
          <h1 className="display mt-1">{t.live.title}</h1>
        </div>
        <p className="text-label-2" aria-live="off">
          {now ? (
            <>
              <span>{i.date(new Date(now))}</span>
              <span className="mx-2" aria-hidden>·</span>
              <time className="tnum font-semibold text-label">{i.clock(new Date(now))}</time>
            </>
          ) : (
            <span className="inline-block h-5 w-56" />
          )}
        </p>
      </header>

      {/* KPIs */}
      {summary.error && !s ? (
        <ErrorState onRetry={() => summary.mutate()} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {s ? (
            <>
              <Kpi className="col-span-2 lg:col-span-1" icon={DoorOpen} tone="green" label={t.live.kpi.free} value={s.rooms_free} format={i.num} hint={t.live.kpi.freeOf(i.num(s.rooms_total))} />
              <Kpi icon={Gauge} tone="blue" label={t.live.kpi.occupancy} value={s.occupancy_pct} format={i.pct} />
              <Kpi icon={CalendarCheck} tone="purple" label={t.live.kpi.meetings} value={s.meetings_today} format={i.num} />
              <Kpi icon={Timer} tone="orange" label={t.live.kpi.saved} value={s.minutes_saved_today} format={i.num} hint={t.live.kpi.savedHint} />
              <Kpi icon={Sparkles} tone="blue" label={t.live.kpi.auto} value={s.auto_booked_today} format={i.num} hint={t.live.kpi.autoHint(i.num(s.no_shows_today))} />
            </>
          ) : (
            Array.from({ length: 5 }, (_, k) => <Skeleton key={k} className={`h-32 !rounded-[22px] ${k === 0 ? "col-span-2 lg:col-span-1" : ""}`} />)
          )}
        </div>
      )}

      {/* Floor plan */}
      <Section
        title={t.live.floorPlan}
        hint={t.live.planHint}
        action={
          <Segmented
            label={t.live.floorsLabel}
            value={floor}
            onChange={setFloor}
            options={[1, 2, 3].map((f) => {
              const fs = s?.floors.find((x) => x.floor === f);
              return {
                value: f,
                label: (
                  <>
                    {t.common.floor(i.num(f))}
                    {fs && <span className="rounded-full bg-green/15 px-1.5 text-[0.6875rem] font-semibold text-green-ink" aria-label={t.live.freeCount(i.num(fs.free))}>{i.num(fs.free)}</span>}
                  </>
                ),
              };
            })}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="card p-3 sm:p-4">
            {rooms.error && !rooms.data ? (
              <ErrorState onRetry={() => rooms.mutate()} />
            ) : rooms.data ? (
              <FloorPlan floor={floor} rooms={onFloor} dim={(r) => filtered && !match(r)} onSelect={setSelected} />
            ) : (
              <Skeleton className="aspect-[5/3] w-full" />
            )}
            <ul className="caption mt-3 flex flex-wrap gap-4 px-1 text-label-2">
              {(["free", "busy", "soon"] as const).map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${statusTone[k].dot}`} aria-hidden />
                  {t.live.legend[k]}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-2 font-semibold">{t.live.happening}</h3>
            {!rooms.data ? (
              <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
            ) : happening.length === 0 ? (
              <p className="caption text-label-2">{t.live.allFree}</p>
            ) : (
              <ul className="divide-y divide-sep">
                {happening.map((r) => {
                  const b = r.status === "busy" ? r.current : r.next;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setSelected(r.id)} className="press flex min-h-14 w-full items-center gap-3 py-2 text-start">
                        <span className={`size-2.5 shrink-0 rounded-full ${statusTone[r.status].dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.name[i.locale]}</span>
                          <span className="caption block truncate text-label-2">{b ? bookingTitle(i, b) : t.status[r.status]}</span>
                        </span>
                        {b && (
                          <span className="caption tnum shrink-0 text-label-2">
                            {r.status === "busy" ? t.live.endsIn(i.time(b.end)) : t.live.startsAt(i.time(b.start))}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* Room finder */}
      <Section title={t.live.rooms} hint={rooms.data ? t.live.count(i.num(list.length)) : undefined}>
        <div className="mb-4 space-y-3">
          <label className="relative block">
            <span className="sr-only">{t.live.search}</span>
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-label-2" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.live.search}
              className="min-h-11 w-full rounded-xl bg-card ps-10 pe-3 text-[1rem] shadow-[var(--shadow)] outline-none placeholder:text-label-2 focus:ring-2 focus:ring-blue md:max-w-sm"
            />
          </label>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Chip on={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
              <span className="size-2 rounded-full bg-green" aria-hidden />
              {t.live.freeOnly}
            </Chip>
            <span className="mx-1 w-px shrink-0 self-stretch bg-sep" aria-hidden />
            {CAPS.map((c) => (
              <Chip key={c} on={cap === c} onClick={() => setCap(cap === c ? 0 : c)} label={`${t.live.capacityLabel}: ${t.live.capacity(i.num(c))}`}>
                <Users className="size-4" aria-hidden />
                {t.live.capacity(i.num(c))}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-sep" aria-hidden />
            {EQUIPMENT.map((e) => {
              const Icon = equipmentIcon[e];
              const on = equip.includes(e);
              return (
                <Chip key={e} on={on} onClick={() => setEquip(on ? equip.filter((x) => x !== e) : [...equip, e])}>
                  <Icon className="size-4" aria-hidden />
                  {t.equipment[e]}
                </Chip>
              );
            })}
          </div>
        </div>

        {rooms.error && !rooms.data ? null : !rooms.data ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, k) => <Skeleton key={k} className="h-40 !rounded-[22px]" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-label-2">{t.live.empty}</p>
            <button type="button" onClick={() => { setFreeOnly(false); setCap(0); setEquip([]); setQ(""); }} className="press min-h-11 rounded-full bg-fill px-5 text-sm font-semibold text-blue-ink">
              {t.live.clearFilters}
            </button>
          </div>
        ) : (
          <motion.ul layout className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((r) => (
                <motion.li key={r.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
                  <RoomCard room={r} onOpen={() => setSelected(r.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </Section>

      <RoomSheet id={selected} onClose={close} />
    </div>
  );
}

function RoomCard({ room: r, onOpen }: { room: Room; onOpen: () => void }) {
  const i = useI18n();
  const { t } = i;
  const line = r.current ? t.busyUntil(i.time(r.current.end)) : r.free_until ? t.freeUntil(i.time(r.free_until)) : t.freeAllDay;
  return (
    <button type="button" onClick={onOpen} className="press card flex h-full w-full flex-col gap-3 p-4 text-start hover:bg-card-2 sm:p-5">
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[1.0625rem] font-semibold">{r.name[i.locale]}</h3>
          <p className="caption text-label-2">{t.common.floor(i.num(r.floor))} · {t.kind[r.kind]}</p>
        </div>
        <StatusPill status={r.status} />
      </div>
      <p className="flex items-center gap-1.5 text-[0.9375rem]">
        <Clock className="size-4 shrink-0 text-label-2" aria-hidden />
        <span className="tnum">{line}</span>
      </p>
      {r.current && <p className="caption -mt-2 truncate text-label-2">{bookingTitle(i, r.current)}</p>}
      <div className="mt-auto flex w-full items-center justify-between gap-2 pt-1">
        <span className="caption flex items-center gap-1 font-medium text-label-2">
          <Users className="size-3.5" aria-hidden />
          {i.num(r.capacity)}
          {r.people > 0 && (
            <span className="ms-2 flex gap-0.5" aria-label={t.room.peopleNow(i.num(r.people))}>
              {Array.from({ length: Math.min(r.people, 8) }, (_, k) => <span key={k} className="size-1.5 rounded-full bg-label/50" />)}
            </span>
          )}
        </span>
        <span className="flex gap-1.5 text-label-2">
          {r.equipment.map((e) => {
            const Icon = equipmentIcon[e];
            return <Icon key={e} className="size-4" aria-label={t.equipment[e]} />;
          })}
        </span>
      </div>
    </button>
  );
}
