"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { I18nProvider, type Locale } from "@/lib/i18n";
import { fetcher } from "@/lib/api";

type Toast = { id: number; kind: "success" | "error"; text: string };
const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export const spring = { type: "spring", bounce: 0, duration: 0.4 } as const;

export default function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    if (t.kind === "success") navigator.vibrate?.(8);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 3600);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <I18nProvider locale={locale}>
        <SWRConfig value={{ fetcher, refreshInterval: 10_000, revalidateOnFocus: true }}>
          <MotionConfig reducedMotion="user" transition={spring}>
            <ToastCtx.Provider value={push}>
              {children}
              <div
                aria-live="polite"
                className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[70] flex flex-col items-center gap-2 px-4 md:top-20"
              >
                <AnimatePresence initial={false}>
                  {toasts.map((t) => (
                    <motion.div
                      key={t.id}
                      layout
                      role={t.kind === "error" ? "alert" : "status"}
                      initial={{ opacity: 0, y: -16, scale: 0.96, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -12, scale: 0.96, filter: "blur(6px)" }}
                      className="material pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-4 py-2.5 text-[0.9375rem] font-medium shadow-[var(--shadow-lg)]"
                    >
                      {t.kind === "success" ? (
                        <CircleCheck className="size-5 shrink-0 text-green-ink" aria-hidden />
                      ) : (
                        <CircleAlert className="size-5 shrink-0 text-red-ink" aria-hidden />
                      )}
                      <span>{t.text}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ToastCtx.Provider>
          </MotionConfig>
        </SWRConfig>
      </I18nProvider>
    </ThemeProvider>
  );
}
