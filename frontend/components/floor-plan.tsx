"use client";

import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/lib/i18n";
import type { Room, RoomStatus } from "@/lib/api";

const color: Record<RoomStatus, string> = { free: "var(--green)", busy: "var(--red)", soon: "var(--orange)" };

export default function FloorPlan({ floor, rooms, dim, onSelect }: { floor: number; rooms: Room[]; dim: (r: Room) => boolean; onSelect: (id: string) => void }) {
  const i = useI18n();
  const { t, locale } = i;
  return (
    // Phones: keep labels legible by letting the plan pan sideways instead of shrinking it to ~8px text.
    <div className="relative w-full overflow-x-auto overscroll-x-contain [scrollbar-width:none]" dir="ltr">
      <svg viewBox="0 0 100 60" className="block h-auto w-full min-w-[500px]" role="group" aria-label={`${t.live.floorPlan} — ${t.common.floor(i.num(floor))}`}>
        <rect x="0.5" y="0.5" width="99" height="59" rx="3" fill="var(--card-2)" stroke="var(--sep)" strokeWidth="0.3" />
        <rect x="1.5" y="25" width="97" height="10" rx="2" fill="var(--fill)" />
        <AnimatePresence initial={false}>
          <motion.g key={floor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {rooms.map((r) => {
              const name = r.name[locale];
              const c = color[r.status];
              const small = r.w < 14;
              const dots = Math.min(r.people, small ? 4 : 8);
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={[name, t.status[r.status], t.room.capacity(i.num(r.capacity))].join(locale === "fa" ? "، " : ", ")}
                  onClick={() => onSelect(r.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.id))}
                  className="cursor-pointer outline-none transition-[opacity,transform] duration-200 [transform-box:fill-box] origin-center active:scale-[0.97] [&:focus-visible>rect:first-child]:stroke-[var(--blue)] [&:focus-visible>rect:first-child]:[stroke-width:0.9]"
                  style={{ opacity: dim(r) ? 0.28 : 1 }}
                >
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="1.6" fill={c} fillOpacity="0.14" stroke={c} strokeWidth="0.35" />
                  {r.status === "busy" && <rect className="pulse" x={r.x} y={r.y} width={r.w} height={r.h} rx="1.6" fill={c} fillOpacity="0.5" />}
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2 - (small ? 0.4 : 1)} textAnchor="middle" fontSize={small ? 2.1 : 2.7} fontWeight="650" fill="var(--label)" direction={locale === "fa" ? "rtl" : "ltr"}>
                    {name}
                  </text>
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (small ? 2.2 : 2.6)} textAnchor="middle" fontSize={small ? 1.6 : 1.9} fill="var(--label-2)" direction={locale === "fa" ? "rtl" : "ltr"}>
                    {small ? i.num(r.capacity) : t.common.people(i.num(r.capacity))}
                  </text>
                  <circle cx={r.x + r.w - 2} cy={r.y + 2} r="0.9" fill={c} />
                  {Array.from({ length: dots }, (_, k) => (
                    <circle key={k} cx={r.x + r.w / 2 + (k - (dots - 1) / 2) * 2} cy={r.y + r.h - 2.2} r="0.65" fill="var(--label)" fillOpacity="0.55" />
                  ))}
                </g>
              );
            })}
          </motion.g>
        </AnimatePresence>
      </svg>
    </div>
  );
}
