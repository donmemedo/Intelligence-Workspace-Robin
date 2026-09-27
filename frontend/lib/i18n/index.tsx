"use client";

import { createContext, useContext, useMemo } from "react";
import fa, { type Dict } from "./fa";
import en from "./en";

export type Locale = "fa" | "en";
export const TZ = "Asia/Tehran";

function make(locale: Locale) {
  const tag = locale === "fa" ? "fa-IR" : "en-US";
  const n = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0 });
  const time = new Intl.DateTimeFormat(tag, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const clock = new Intl.DateTimeFormat(tag, { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const date = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-US", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  const short = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-US", { timeZone: "UTC", day: "numeric", month: "short" });
  return {
    locale,
    t: (locale === "fa" ? fa : en) as Dict,
    dir: locale === "fa" ? "rtl" : "ltr",
    num: (v: number) => n.format(v),
    pct: (v: number) => pct.format(v / 100),
    time: (iso: string | Date) => time.format(new Date(iso)),
    clock: (d: Date) => clock.format(d),
    date: (d: Date) => date.format(d),
    // "YYYY-MM-DD" → localized short day (Jalali in fa)
    day: (ymd: string) => short.format(new Date(ymd + "T12:00:00Z")),
  };
}

export type I18n = ReturnType<typeof make>;
const Ctx = createContext<I18n>(make("fa"));

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => make(locale), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Booking title, localising the backend's auto-booked title. */
export function bookingTitle(i: I18n, b: { title: string; source: string }) {
  return b.title === "Spontaneous meeting" ? i.t.spontaneous : b.title;
}
