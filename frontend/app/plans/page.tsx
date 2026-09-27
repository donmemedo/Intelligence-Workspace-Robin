"use client";

import { useState } from "react";
import { Check, EyeOff, ShieldCheck } from "lucide-react";
import { AnimatedNumber, Segmented } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const PRICE: Record<string, number | null> = { pilot: 0, basic: 990_000, pro: 1_490_000, enterprise: null };
const DAYS = 22, RECOVERED = 0.7;

/** Accepts Persian/Arabic digits and thousands separators. */
const parse = (s: string) => {
  const v = s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,،٬\s]/g, "");
  return /^\d+$/.test(v) ? Number(v) : NaN;
};

export default function Plans() {
  const i = useI18n();
  const { t } = i;
  const [plan, setPlan] = useState<"basic" | "pro">("pro");
  const [form, setForm] = useState({ employees: "120", minutes: "30", hourly: "250000", rooms: "10" });

  const fields = [
    { key: "employees", label: t.plans.roi.employees, max: 100_000 },
    { key: "minutes", label: t.plans.roi.minutes, max: 480 },
    { key: "hourly", label: t.plans.roi.hourly, max: 100_000_000 },
    { key: "rooms", label: t.plans.roi.rooms, max: 10_000 },
  ] as const;
  const val = Object.fromEntries(fields.map((f) => [f.key, parse(form[f.key])])) as Record<(typeof fields)[number]["key"], number>;
  const invalid = (k: (typeof fields)[number]["key"], max: number) => !(val[k] >= 1 && val[k] <= max);
  const ok = fields.every((f) => !invalid(f.key, f.max));

  const hours = ok ? (val.employees * val.minutes * DAYS * RECOVERED) / 60 : 0;
  const value = ok ? hours * val.hourly : 0;
  const cost = ok ? val.rooms * (PRICE[plan] ?? 0) : 0;
  const multiple = cost ? value / cost : 0;
  const toman = (n: number) => t.plans.roi.toman(i.num(Math.round(n)));

  const choose = (id: string) => {
    if (id === "basic" || id === "pro") setPlan(id);
    document.getElementById("roi")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="space-y-10 md:space-y-14">
      <header className="pt-2 text-center">
        <h1 className="display">{t.plans.title}</h1>
        <p className="mx-auto mt-2 max-w-xl text-label-2">{t.plans.subtitle}</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {t.plans.items.map((p) => {
          const price = PRICE[p.id];
          const hot = p.id === "pro";
          return (
            <li key={p.id} className={`relative rounded-[24px] ${hot ? "bg-gradient-to-br from-[#0a84ff] via-[#5e5ce6] to-[#bf5af2] p-[1.5px] shadow-[0_24px_60px_-24px_rgba(94,92,230,0.6)]" : ""}`}>
              <article className="card flex h-full flex-col gap-4 p-5 sm:p-6" style={hot ? { borderRadius: 22.5 } : undefined} aria-labelledby={`plan-${p.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${p.id}`} className="title-2">{p.name}</h2>
                  {hot && <span className="rounded-full bg-gradient-to-r from-[#0a6cff] to-[#8e44d9] px-2.5 py-1 text-xs font-semibold text-white">{t.plans.popular}</span>}
                </div>
                <p className="caption -mt-2 text-label-2">{p.desc}</p>
                <div className="min-h-16">
                  {price === null ? (
                    <p className="text-2xl font-bold tracking-tight">{t.plans.custom}</p>
                  ) : price === 0 ? (
                    <p className="text-[2rem] font-bold leading-tight tracking-tight">{t.plans.free}</p>
                  ) : (
                    <>
                      <p className="tnum text-[2rem] font-bold leading-tight tracking-tight">{i.num(price)}</p>
                      <p className="caption text-label-2">{t.plans.perRoom}</p>
                    </>
                  )}
                </div>
                <ul className="flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[0.9375rem]">
                      <Check className="mt-1 size-4 shrink-0 text-green-ink" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choose(p.id)}
                  className={`press min-h-11 rounded-full px-5 font-semibold ${hot ? "bg-accent text-white" : "bg-fill text-blue-ink hover:bg-fill-2"}`}
                >
                  {p.cta}
                </button>
              </article>
            </li>
          );
        })}
      </ul>

      <section id="roi" aria-labelledby="roi-title" className="scroll-mt-24 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-5 sm:p-6">
          <h2 id="roi-title" className="title-2">{t.plans.roi.title}</h2>
          <p className="caption mt-1 text-label-2">{t.plans.roi.subtitle}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const bad = invalid(f.key, f.max);
              return (
                <label key={f.key} className="block">
                  <span className="caption mb-1 block font-medium text-label-2">{f.label}</span>
                  <input
                    inputMode="numeric"
                    dir="ltr"
                    value={i.locale === "fa" ? form[f.key].replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    aria-invalid={bad}
                    aria-describedby={bad ? `${f.key}-err` : undefined}
                    className="tnum min-h-11 w-full rounded-xl bg-fill px-3 text-end text-[1rem] outline-none focus:ring-2 focus:ring-blue aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red"
                  />
                  {bad && (
                    <span id={`${f.key}-err`} className="caption mt-1 block text-red-ink">
                      {form[f.key].trim() ? t.plans.roi.range(i.num(1), i.num(f.max)) : t.validation.required}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-5">
            <span className="caption mb-1 block font-medium text-label-2">{t.plans.roi.plan}</span>
            <Segmented
              className="w-full"
              label={t.plans.roi.plan}
              value={plan}
              onChange={setPlan}
              options={(["basic", "pro"] as const).map((id) => ({ value: id, label: t.plans.items.find((p) => p.id === id)!.name }))}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0050c8] via-[#4b3fd1] to-[#8a2fc9] p-5 text-white shadow-[var(--shadow-lg)] sm:p-6">
          <div className="pointer-events-none absolute -end-20 -top-24 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
          <dl className="relative grid h-full grid-cols-2 content-between gap-5">
            <div className="col-span-2">
              <dt className="text-sm font-medium text-white/80">{t.plans.roi.multiple}</dt>
              <dd className="mt-1 text-[3.25rem] font-bold leading-none tracking-tight">
                {ok && cost ? <AnimatedNumber value={Math.round(multiple * 10) / 10} format={(n) => t.plans.roi.times(i.num(n))} /> : "—"}
              </dd>
            </div>
            <Stat label={t.plans.roi.hours} value={hours} format={(n) => i.num(Math.round(n))} />
            <Stat label={t.plans.roi.value} value={value} format={toman} />
            <Stat label={t.plans.roi.cost} value={cost} format={toman} />
            <p className="col-span-2 text-xs leading-relaxed text-white/80">{t.plans.roi.assumption}</p>
          </dl>
        </div>
      </section>

      <section aria-labelledby="privacy-title" className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -start-24 -bottom-24 size-72 rounded-full bg-green/15 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
          <span className="grid size-16 place-items-center rounded-[20px] bg-green/15 text-green-ink">
            <ShieldCheck className="size-8" aria-hidden />
          </span>
          <div>
            <h2 id="privacy-title" className="title-2">{t.plans.privacy.title}</h2>
            <p className="mt-1 text-xl font-semibold tracking-tight">{t.plans.privacy.lead}</p>
          </div>
          <ul className="space-y-2.5">
            {t.plans.privacy.points.map((p) => (
              <li key={p} className="flex gap-2 text-[0.9375rem]">
                <EyeOff className="mt-1 size-4 shrink-0 text-green-ink" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-white/80">{label}</dt>
      <dd className="mt-1 break-words text-xl font-bold tracking-tight">
        <AnimatedNumber value={value} format={format} />
      </dd>
    </div>
  );
}
