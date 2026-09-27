"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Monitor, Phone, Presentation, Projector, Tv, WifiOff, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Equipment, RoomStatus } from "@/lib/api";

/** Current time, ticking every `ms`; 0 during SSR so markup stays deterministic. */
export function useNow(ms = 1000) {
  return useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, ms);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => format(Math.round(v * 10) / 10));
  useEffect(() => {
    const c = animate(mv, value, { type: "spring", bounce: 0, duration: 1.1 });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className="tnum">{text}</motion.span>;
}

export function Kpi({ label, value, format, hint, icon: Icon, tone = "blue", className = "" }: {
  label: string; value: number; format: (n: number) => string; hint?: string; icon: LucideIcon; tone?: "blue" | "green" | "orange" | "red" | "purple"; className?: string;
}) {
  const tones = {
    blue: "bg-blue/15 text-blue-ink",
    green: "bg-green/15 text-green-ink",
    orange: "bg-orange/15 text-orange-ink",
    red: "bg-red/15 text-red-ink",
    purple: "bg-[#af52de]/15 text-[#8e3bbd] dark:text-[#da8fff]",
  };
  return (
    <div className={`card flex flex-col gap-3 p-4 sm:p-5 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className={`grid size-8 place-items-center rounded-[10px] ${tones[tone]}`}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="caption font-medium text-label-2">{label}</span>
      </div>
      <div className="text-[1.875rem] font-bold leading-none tracking-tight sm:text-[2.125rem]">
        <AnimatedNumber value={value} format={format} />
      </div>
      {hint && <p className="caption -mt-1 text-label-2">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label, className = "" }: {
  value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-[12px] bg-fill p-0.5 ${className}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-sm font-medium transition-colors ${on ? "text-label" : "text-label-2 hover:text-label"}`}
          >
            {on && <motion.span layoutId={id} className="absolute inset-0 rounded-[10px] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.12)] dark:bg-[#636366]" />}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={`press flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium ${on ? "bg-accent text-white" : "bg-card text-label shadow-[var(--shadow)] hover:bg-card-2"}`}
    >
      {children}
    </button>
  );
}

export const statusTone: Record<RoomStatus, { dot: string; pill: string }> = {
  free: { dot: "bg-green", pill: "bg-green/15 text-green-ink" },
  busy: { dot: "bg-red", pill: "bg-red/15 text-red-ink" },
  soon: { dot: "bg-orange", pill: "bg-orange/15 text-orange-ink" },
};

export function StatusPill({ status }: { status: RoomStatus }) {
  const { t } = useI18n();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[status].pill}`}>
      <span className={`size-1.5 rounded-full ${statusTone[status].dot} ${status === "busy" ? "pulse !opacity-100" : ""}`} aria-hidden />
      {t.status[status]}
    </span>
  );
}

export const equipmentIcon: Record<Equipment, LucideIcon> = { video: Monitor, tv: Tv, whiteboard: Presentation, projector: Projector, phone: Phone };

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer ${className}`} aria-hidden />;
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-fill">
        <WifiOff className="size-6 text-label-2" aria-hidden />
      </span>
      <p className="font-medium">{t.common.network}</p>
      <button type="button" onClick={onRetry} className="press min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-white">
        {t.common.retry}
      </button>
    </div>
  );
}

export function Section({ title, hint, action, children, className = "" }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className} aria-label={title}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="title-2">{title}</h2>
          {hint && <p className="caption mt-0.5 text-label-2">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
