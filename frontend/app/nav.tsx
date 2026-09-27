"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition } from "react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { ChartNoAxesColumn, Gem, Languages, Monitor, Moon, Radar, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const noop = () => () => {};

export function Logo({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Link href="/" className={`press flex items-center gap-2.5 rounded-xl ${className}`} aria-label={t.brand}>
      <svg viewBox="0 0 64 64" className="size-8 shrink-0" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0a84ff" />
            <stop offset="1" stopColor="#bf5af2" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#lg)" />
        <circle cx="32" cy="36" r="6" fill="#fff" />
        <path d="M20 36a12 12 0 0 1 24 0M13 36a19 19 0 0 1 38 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".85" />
      </svg>
      <span className="text-[1.0625rem] font-semibold tracking-tight">{t.brand}</span>
    </Link>
  );
}

function Toggles() {
  const { t, locale } = useI18n();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [pending, start] = useTransition();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const mode = (mounted ? theme : "system") as "system" | "light" | "dark";
  const nextMode = { system: "light", light: "dark", dark: "system" } as const;
  const Icon = { system: Monitor, light: Sun, dark: Moon }[mode] ?? Monitor;

  const switchLang = () => {
    document.cookie = `lang=${locale === "fa" ? "en" : "fa"}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  };

  const btn = "press grid size-11 place-items-center rounded-full text-label-2 hover:bg-fill hover:text-label";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => setTheme(nextMode[mode] ?? "system")} aria-label={t.theme.label(t.theme[mode])} title={t.theme.label(t.theme[mode])}>
        <Icon className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        className="press flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-label-2 hover:bg-fill hover:text-label disabled:opacity-50"
        onClick={switchLang}
        disabled={pending}
        aria-label={t.langSwitchLabel}
        lang={locale === "fa" ? "en" : "fa"}
      >
        <Languages className="size-4.5" aria-hidden />
        {t.langSwitch}
      </button>
    </div>
  );
}

export default function Nav() {
  const { t } = useI18n();
  const path = usePathname();
  const items = [
    { href: "/", label: t.nav.live, icon: Radar },
    { href: "/analytics", label: t.nav.analytics, icon: ChartNoAxesColumn },
    { href: "/plans", label: t.nav.plans, icon: Gem },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="material pt-safe sticky top-0 z-40 border-b border-sep">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 md:h-16 lg:px-8">
          <Logo />
          <nav aria-label={t.navLabel} className="hidden rounded-full bg-fill p-1 md:flex">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active(it.href) ? "page" : undefined}
                className={`press relative flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium ${active(it.href) ? "text-label" : "text-label-2 hover:text-label"}`}
              >
                {active(it.href) && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-card shadow-sm" />}
                <it.icon className="relative size-4" aria-hidden />
                <span className="relative">{it.label}</span>
              </Link>
            ))}
          </nav>
          <Toggles />
        </div>
      </header>

      <nav aria-label={t.navLabel} className="material pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-sep md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {items.map((it) => {
            const on = active(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${on ? "text-blue-ink" : "text-label-2"}`}
              >
                <it.icon className="size-6" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
