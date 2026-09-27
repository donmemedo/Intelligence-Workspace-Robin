"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Clock, Gauge, Hourglass, Lightbulb, Sparkles, UserX } from "lucide-react";
import { ErrorState, Kpi, Section, Segmented, Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { Analytics } from "@/lib/api";

const RANGES = [7, 14, 30] as const;
const HOURS = Array.from({ length: 12 }, (_, k) => k + 8);

export default function AnalyticsPage() {
  const i = useI18n();
  const { t } = i;
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const { data: a, error, mutate } = useSWR<Analytics>(`/analytics?days=${days}`, { keepPreviousData: true, refreshInterval: 60_000 });

  return (
    <div className="space-y-8 md:space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="display">{t.analytics.title}</h1>
          <p className="mt-1 text-label-2">{t.analytics.subtitle}</p>
        </div>
        <Segmented label={t.analytics.rangeLabel} value={days} onChange={setDays} options={RANGES.map((d) => ({ value: d, label: t.analytics.range(i.num(d)) }))} />
      </header>

      {error && !a ? (
        <ErrorState onRetry={() => mutate()} />
      ) : !a ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }, (_, k) => <Skeleton key={k} className={`h-32 !rounded-[22px] ${k === 0 ? "col-span-2 lg:col-span-1" : ""}`} />)}
          </div>
          <Skeleton className="h-72 !rounded-[22px]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <Kpi className="col-span-2 lg:col-span-1" icon={Gauge} tone="blue" label={t.analytics.utilization} value={a.utilization_pct} format={i.pct} />
            <Kpi icon={UserX} tone="red" label={t.analytics.noShow} value={a.no_show_rate_pct} format={i.pct} />
            <Kpi icon={Sparkles} tone="purple" label={t.analytics.auto} value={a.auto_booked_pct} format={i.pct} />
            <Kpi icon={Clock} tone="orange" label={t.analytics.avg} value={a.avg_meeting_minutes} format={(n) => t.common.minutes(i.num(Math.round(n)))} />
            <Kpi icon={Hourglass} tone="green" label={t.analytics.saved} value={a.hours_saved} format={i.num} />
          </div>

          <Section title={t.analytics.daily} hint={t.analytics.dailyHint}>
            <div className="card p-4 sm:p-5">
              <Trend data={a.daily} />
            </div>
          </Section>

          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-6">
            <div className="grid gap-8 lg:gap-6">
              <Section title={t.analytics.heatmap} hint={t.analytics.heatmapHint}>
                <div className="card p-4 sm:p-5">
                  <Heatmap cells={a.heatmap} />
                </div>
              </Section>
              <Underused a={a} />
            </div>
            <Section title={t.analytics.ranking}>
              <div className="card p-4 sm:p-5">
                <Ranking a={a} />
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Trend({ data }: { data: Analytics["daily"] }) {
  const i = useI18n();
  const { t } = i;
  const [sel, setSel] = useState<number | null>(null);
  const W = 100, H = 40, n = data.length;
  const max = Math.max(10, ...data.map((d) => d.utilization_pct)) * 1.15;
  // RTL mirrors the time axis: newest day sits at the inline end.
  const x = (k: number) => {
    const p = n <= 1 ? W / 2 : (k / (n - 1)) * W;
    return i.dir === "rtl" ? W - p : p;
  };
  const y = (v: number) => H - (v / max) * H;
  const pts = data.map((d, k) => `${x(k).toFixed(2)},${y(d.utilization_pct).toFixed(2)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(n - 1)},${H} L${x(0)},${H} Z`;
  const step = Math.ceil(n / 7);
  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    let p = (clientX - r.left) / r.width;
    if (i.dir === "rtl") p = 1 - p;
    setSel(Math.max(0, Math.min(n - 1, Math.round(p * (n - 1)))));
  };
  // Nothing hovered: show the latest day instead of repeating the section hint.
  const s = n ? data[sel ?? n - 1] : null;

  return (
    <div>
      <div className="mb-3 min-h-12" aria-live="polite">
        {s ? (
          <>
            <p className="caption text-label-2">{i.day(s.date)}</p>
            <p className="flex items-baseline gap-2 font-semibold">
              <span className="tnum text-xl">{i.pct(s.utilization_pct)}</span>
              <span className="caption font-normal text-label-2">{t.analytics.bookings(i.num(s.bookings))}</span>
            </p>
          </>
        ) : (
          <p className="caption pt-5 text-label-2">{t.analytics.dailyHint}</p>
        )}
      </div>
      <div
        className="relative touch-pan-y"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}
        tabIndex={0}
        role="slider"
        aria-label={t.analytics.daily}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={sel ?? n - 1}
        aria-valuetext={s ? `${i.day(s.date)}: ${i.pct(s.utilization_pct)}` : undefined}
        onKeyDown={(e) => {
          const fwd = i.dir === "rtl" ? "ArrowLeft" : "ArrowRight", back = i.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
          if (e.key === fwd || e.key === back) {
            e.preventDefault();
            setSel((c) => Math.max(0, Math.min(n - 1, (c ?? n - 1) + (e.key === fwd ? 1 : -1))));
          }
        }}
      >
        <svg viewBox={`0 -2 ${W} ${H + 2}`} preserveAspectRatio="none" className="block h-44 w-full overflow-visible sm:h-56" aria-hidden>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--blue)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--sep)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />
          ))}
          <clipPath id="trend-clip">
            <motion.rect key={`c${n}${i.dir}`} y="-2" width={W} height={H + 2} initial={{ x: i.dir === "rtl" ? W : -W }} animate={{ x: 0 }} transition={{ type: "spring", bounce: 0, duration: 1 }} />
          </clipPath>
          <g clipPath="url(#trend-clip)">
            <path d={area} fill="url(#trend-fill)" />
            <path d={line} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
          {sel !== null && <line x1={x(sel)} x2={x(sel)} y1="-2" y2={H} stroke="var(--label-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        </svg>
        {sel !== null && s && (
          <span
            className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-blue shadow"
            style={{ left: `${x(sel)}%`, top: `${((y(s.utilization_pct) + 2) / (H + 2)) * 100}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="caption tnum relative mt-2 h-5 text-label-2" aria-hidden>
        {data.map((d, k) =>
          (n - 1 - k) % step === 0 ? (
            <span key={d.date} className={`absolute -translate-x-1/2 whitespace-nowrap ${((n - 1 - k) / step) % 2 ? "max-sm:hidden" : ""}`} style={{ left: `${Math.min(96, Math.max(4, x(k)))}%` }}>
              {i.day(d.date)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

function Heatmap({ cells }: { cells: Analytics["heatmap"] }) {
  const i = useI18n();
  const { t } = i;
  const [sel, setSel] = useState<{ d: number; h: number } | null>(null);
  const get = (d: number, h: number) => cells.find((c) => c.weekday === d && c.hour === h)?.pct ?? 0;
  const max = Math.max(1, ...cells.map((c) => c.pct));
  const bg = (p: number) => `color-mix(in srgb, var(--blue) ${Math.round(8 + (p / max) * 86)}%, var(--fill))`;
  const readout = sel ? t.analytics.heatCell(t.weekdays[sel.d], i.num(sel.h), i.pct(get(sel.d, sel.h))) : null;

  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-[3px]" onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}>
        <caption className="sr-only">{t.analytics.heatmapHint}</caption>
        <thead>
          <tr>
            <th className="w-8" aria-hidden />
            {HOURS.map((h) => (
              <th key={h} scope="col" className="caption tnum pb-1 text-center text-[0.6875rem] font-normal text-label-2">
                {h % 2 === 0 ? i.num(h) : <span className="sr-only">{i.num(h)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.weekdays.map((wd, d) => (
            <tr key={wd}>
              <th scope="row" className="caption pe-1 text-start font-medium text-label-2">
                <span aria-hidden>{t.weekdaysShort[d]}</span>
                <span className="sr-only">{wd}</span>
              </th>
              {HOURS.map((h) => {
                const p = get(d, h);
                const on = sel?.d === d && sel.h === h;
                return (
                  <td
                    key={h}
                    onPointerEnter={() => setSel({ d, h })}
                    onClick={() => setSel({ d, h })}
                    className={`aspect-square rounded-[5px] transition-[box-shadow] duration-150 sm:rounded-md ${on ? "shadow-[0_0_0_2px_var(--label)]" : ""}`}
                    style={{ background: bg(p) }}
                  >
                    <span className="sr-only">{i.pct(p)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="caption tnum min-h-5 font-medium" aria-live="polite">{readout}</p>
        <div className="caption flex items-center gap-1.5 text-label-2" aria-hidden>
          {t.analytics.less}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f} className="size-3 rounded-[3px]" style={{ background: bg(f * max) }} />)}
          {t.analytics.more}
        </div>
      </div>
    </div>
  );
}

function Ranking({ a }: { a: Analytics }) {
  const i = useI18n();
  const { t } = i;
  const max = Math.max(1, ...a.rooms.map((r) => r.utilization_pct));
  return (
    <ol className="space-y-3">
      {a.rooms.map((r, k) => {
        const low = a.underused.includes(r.id);
        return (
          <li key={r.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-2">
            <span className="caption tnum text-center text-label-2">{i.num(k + 1)}</span>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[0.9375rem] font-medium">
                  {r.name[i.locale]}
                  <span className="caption ms-2 text-label-2">{t.common.floor(i.num(r.floor))}</span>
                </span>
                <span className="caption tnum shrink-0 font-semibold">{i.pct(r.utilization_pct)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-fill">
                <motion.div
                  className={`h-full rounded-full ${low ? "bg-orange" : "bg-blue"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.utilization_pct / max) * 100}%` }}
                  transition={{ type: "spring", bounce: 0, duration: 0.8, delay: Math.min(k * 0.03, 0.4) }}
                />
              </div>
              <p className="caption mt-0.5 text-label-2">
                {t.analytics.bookings(i.num(r.bookings))} · {t.analytics.noShows(i.num(r.no_shows))}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Underused({ a }: { a: Analytics }) {
  const i = useI18n();
  const { t } = i;
  const rooms = a.rooms.filter((r) => a.underused.includes(r.id));
  return (
    <section aria-label={t.analytics.underused} className="card relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-orange/20 blur-3xl" aria-hidden />
      <div className="relative flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange/15 text-orange-ink">
          <Lightbulb className="size-5.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="title-2">{t.analytics.underused}</h2>
          {rooms.length === 0 ? (
            <p className="mt-1 text-label-2">{t.analytics.allGood}</p>
          ) : (
            <>
              <ul className="mt-3 flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <li key={r.id} className="rounded-full bg-orange/15 px-3 py-1.5 text-sm font-semibold text-orange-ink">
                    {r.name[i.locale]} · <span className="tnum">{i.pct(r.utilization_pct)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 max-w-2xl text-label-2">{t.analytics.underusedBody}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
