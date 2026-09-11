import { redirect } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/card";
import { ProfileForm } from "@/components/professional/profile-form";

export default async function OnboardingPage() {
  const viewer = await requireViewer();
  if (viewer.professionalProfileId) redirect("/professional/profile");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Become a professional" title="Create your professional profile" description="Your profile is private until you publish it. Everything you enter is self-declared until the platform verifies it. Next you will add languages, expertise and credentials." />
      <ProfileForm mode="create" initial={{ displayName: viewer.name, title: "", bio: "", country: "", region: "", yearsExperience: "" }} />
    </div>
  );
}
