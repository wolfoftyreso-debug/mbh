/**
 * Single source of truth for naming. The internal codename is HumanAuth; the
 * public brand, tagline and domain are configured through environment
 * variables so the product can be renamed without touching feature code.
 */
export const brand = {
  codename: "HumanAuth",
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "HumanAuth",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "Verified human authorship, review and expert sign-off",
  recordPrefix: process.env.RECORD_ID_PREFIX || "HA",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
} as const;

export const AGREEMENT_VERSIONS = {
  TERMS_OF_SERVICE: "2026-09-01",
  PROFESSIONAL_CONFIDENTIALITY: "2026-09-01",
} as const;
