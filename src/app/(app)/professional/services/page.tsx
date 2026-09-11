import { asc, eq } from "drizzle-orm";
import { requireProfessional } from "@/server/auth/session";
import { getOwnProfile } from "@/server/domain/professionals/service";
import { db } from "@/server/db";
import { domains, languages, serviceCategories } from "@/server/db/schema";
import { PageHeader } from "@/components/ui/card";
import { ListingsManager } from "@/components/professional/listings-manager";
import { env } from "@/lib/config/env";
import { getT } from "@/server/i18n";

export default async function ServicesPage() {
  const viewer = await requireProfessional();
  const [data, { t }] = await Promise.all([getOwnProfile(viewer), getT()]);
  const [cats, langs, doms] = await Promise.all([
    db.select().from(serviceCategories).where(eq(serviceCategories.active, true)).orderBy(asc(serviceCategories.sortOrder)),
    db.select().from(languages).where(eq(languages.active, true)).orderBy(asc(languages.name)),
    db.select().from(domains).where(eq(domains.active, true)).orderBy(asc(domains.path)),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("pro.services.title")} description={t("pro.services.lead")} />
      <ListingsManager listings={(data?.listings ?? []).map((l) => ({ ...l.listing, categoryName: l.categoryName }))} categories={cats.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))} languages={langs.map((l) => ({ code: l.code, name: l.name }))} domains={doms.map((d) => ({ id: d.id, name: d.name, depth: d.depth }))} defaultCurrency={env.DEFAULT_CURRENCY} />
    </div>
  );
}
