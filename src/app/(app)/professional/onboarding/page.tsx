import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/card";
import { ProfileForm } from "@/components/professional/profile-form";
import { getT } from "@/server/i18n";

export default async function OnboardingPage() {
  const viewer = await requireViewer();
  if (viewer.professionalProfileId) redirect("/professional/profile");
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={t("pro.onb.eyebrow")} title={t("pro.onb.title")} description={t("pro.onb.lead")} />
      <ProfileForm mode="create" initial={{ displayName: viewer.name, title: "", bio: "", country: "", region: "", yearsExperience: "" }} />
    </div>
  );
}
