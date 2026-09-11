import { asc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { domains, languages, professionalProfiles, serviceCategories } from "@/server/db/schema";
import { NewAssignmentWizard } from "@/components/assignments/new-assignment-wizard";
import { env } from "@/lib/config/env";

export const metadata = { title: "New assignment" };

export default async function NewAssignmentPage({ searchParams }: { searchParams: Promise<{ template?: string; professional?: string }> }) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const [langs, cats, doms] = await Promise.all([
    db.select({ code: languages.code, name: languages.name }).from(languages).where(eq(languages.active, true)).orderBy(asc(languages.name)),
    db.select({ id: serviceCategories.id, slug: serviceCategories.slug, name: serviceCategories.name, description: serviceCategories.description, kind: serviceCategories.kind }).from(serviceCategories).where(eq(serviceCategories.active, true)).orderBy(asc(serviceCategories.sortOrder)),
    db.select({ id: domains.id, name: domains.name, path: domains.path, depth: domains.depth }).from(domains).where(eq(domains.active, true)).orderBy(asc(domains.path)),
  ]);
  const invited = sp.professional ? (await db.select({ userId: professionalProfiles.userId, displayName: professionalProfiles.displayName }).from(professionalProfiles).where(eq(professionalProfiles.userId, sp.professional)).limit(1))[0] ?? null : null;
  return (
    <div className="mx-auto max-w-3xl">
      <NewAssignmentWizard
        languages={langs}
        categories={cats}
        domains={doms}
        organizations={viewer.organizations.filter((o) => o.role !== "BILLING").map((o) => ({ id: o.organizationId, name: o.name }))}
        initialTemplate={(sp.template as "STANDARD" | "EXPERT_BRAIN_DUMP" | "DOMAIN_REVIEW" | "MULTI_STAGE" | undefined) ?? null}
        invitedProfessional={invited}
        aiAvailable={env.aiConfigured}
        defaultCurrency={env.DEFAULT_CURRENCY}
      />
    </div>
  );
}
