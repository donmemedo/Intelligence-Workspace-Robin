import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import Providers from "./providers";
import Nav from "./nav";
import type { Locale } from "@/lib/i18n";

async function getLocale(): Promise<Locale> {
  return (await cookies()).get("lang")?.value === "en" ? "en" : "fa";
}

export async function generateMetadata(): Promise<Metadata> {
  const fa = (await getLocale()) === "fa";
  return {
    title: fa ? "رابین — هوش فضای کار" : "Robin — Workspace intelligence",
    description: fa ? "رزرو خودکار اتاق جلسه، نقشه زنده و تحلیل فضای کار" : "Automatic room booking, live room finder and workspace analytics",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <Providers locale={locale}>
          <div className="ambient" aria-hidden />
          <Nav />
          <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-32 pt-4 sm:px-6 md:pb-16 md:pt-8 lg:px-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
