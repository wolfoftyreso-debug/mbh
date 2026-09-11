import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/session";
import { enabledProviders } from "@/server/auth/config";
import { brand } from "@/lib/config/brand";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const viewer = await getViewer();
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  if (viewer) redirect(next);
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{brand.name}</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-ink-3">Use a provider account. We never store passwords for provider sign-ins.</p>
      </div>
      <SignInForm providers={enabledProviders} next={next} error={sp.error ?? null} />
    </div>
  );
}
