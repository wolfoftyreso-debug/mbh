import type { Metadata } from "next";
import "./globals.css";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
