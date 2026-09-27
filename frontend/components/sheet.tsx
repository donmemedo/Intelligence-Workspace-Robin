"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMedia } from "./ui";

const noop = () => () => {};
// Apple's momentum projection (Designing Fluid Interfaces), d = 0.998
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubberband = (o: number, dim: number, c = 0.55) => (o * dim * c) / (dim + c * Math.abs(o));

type Props = { open: boolean; onClose: () => void; label: string; header: React.ReactNode; children: React.ReactNode };

export default function Sheet(props: Props) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{props.open && <Panel {...props} />}</AnimatePresence>, document.body);
}

function Panel({ onClose, label, header, children }: Props) {
  const { t, dir } = useI18n();
  const desktop = useMedia("(min-width: 768px)");
  const panel = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const base = useRef(0);
  const scrim = useTransform(y, [0, 600], [1, 0.1]);

  // Focus management, Esc, focus trap, scroll lock
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  const onPanStart = () => {
    y.stop(); // interruptible: grab it mid-flight, from its presentation value
    base.current = y.get();
  };
  const onPan = (_: PointerEvent, i: PanInfo) => {
    const d = base.current + i.offset.y;
    y.set(d < 0 ? -rubberband(-d, 200) : d);
  };
  const onPanEnd = (_: PointerEvent, i: PanInfo) => {
    const h = panel.current?.offsetHeight ?? 600;
    const v = i.velocity.y;
    if (y.get() + project(v) > h * 0.45) {
      animate(y, h, { type: "spring", bounce: 0, duration: 0.3, velocity: v }).then(onClose);
    } else {
      animate(y, 0, { type: "spring", bounce: Math.abs(v) > 300 ? 0.2 : 0, duration: 0.4, velocity: v });
    }
  };

  const off = dir === "rtl" ? "-110%" : "110%";
  const motionProps = desktop
    ? { initial: { x: off, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: off, opacity: 0 } }
    : { initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0 }, style: { y } };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        aria-hidden
      >
        <motion.div className="absolute inset-0 bg-black/35 dark:bg-black/60" style={{ opacity: scrim }} />
      </motion.div>
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        {...motionProps}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[28px] bg-bg shadow-[var(--shadow-lg)] outline-none md:inset-y-3 md:end-3 md:start-auto md:max-h-none md:w-[440px] md:rounded-[28px]"
      >
        <motion.div {...(desktop ? {} : { onPanStart, onPan, onPanEnd })} className="relative shrink-0 touch-none select-none md:touch-auto md:select-auto">
          <div className="flex justify-center pb-1 pt-2 md:hidden" aria-hidden>
            <span className="h-1.5 w-10 rounded-full bg-fill-2" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="press absolute end-3 top-3 z-10 grid size-11 place-items-center rounded-full text-label-2 hover:text-label"
          >
            <span className="grid size-8 place-items-center rounded-full bg-fill">
              <X className="size-4.5" aria-hidden />
            </span>
          </button>
          {header}
        </motion.div>
        <div className="pb-safe min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </motion.div>
    </div>
  );
}
