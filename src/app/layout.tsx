import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/lib/config/brand";
import { getDict } from "@/server/i18n";
import { I18nProvider } from "@/components/i18n/provider";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getDict();
  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <I18nProvider locale={locale} dict={dict}>{children}</I18nProvider>
      </body>
    </html>
  );
}
