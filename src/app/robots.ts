import type { MetadataRoute } from "next";
import { env } from "@/lib/config/env";

/** robots.txt is a hint for crawlers, never a security mechanism. Private routes are protected by authorization. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/assignments", "/marketplace", "/professional/", "/organizations", "/settings", "/notifications", "/admin", "/api/", "/sign-in"] }],
    sitemap: `${env.APP_URL}/sitemap.xml`,
  };
}
