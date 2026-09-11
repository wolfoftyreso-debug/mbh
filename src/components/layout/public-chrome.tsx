import Link from "next/link";
import { brand } from "@/lib/config/brand";
import { getViewer } from "@/server/auth/session";
import { LinkButton } from "@/components/ui/button";

export async function PublicHeader() {
  const viewer = await getViewer();
  return (
    <header className="border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Mark />
          {brand.name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-2 md:flex">
          <Link href="/professionals" className="hover:text-ink">Find professionals</Link>
          <Link href="/how-it-works" className="hover:text-ink">How it works</Link>
          <Link href="/verification" className="hover:text-ink">Verification</Link>
          <Link href="/confidentiality" className="hover:text-ink">Confidentiality</Link>
        </nav>
        <div className="flex items-center gap-2">
          {viewer ? (
            <LinkButton href="/dashboard" size="sm">Open dashboard</LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost" size="sm">Sign in</LinkButton>
              <LinkButton href="/sign-in?next=/assignments/new" size="sm">Commission work</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-ink-3 md:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 font-semibold text-ink">
            <Mark /> {brand.name}
          </p>
          <p className="mt-2 max-w-xs">{brand.tagline}.</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-ink">Product</p>
          <Link href="/professionals" className="block hover:text-ink">Find professionals</Link>
          <Link href="/how-it-works" className="block hover:text-ink">How it works</Link>
          <Link href="/sign-in?next=/professional/onboarding" className="block hover:text-ink">Become a professional</Link>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-ink">Trust</p>
          <Link href="/verification" className="block hover:text-ink">What verification means</Link>
          <Link href="/confidentiality" className="block hover:text-ink">Confidentiality</Link>
          <Link href="/records" className="block hover:text-ink">Authorship records</Link>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-ink">Legal</p>
          <Link href="/terms" className="block hover:text-ink">Terms</Link>
          <Link href="/privacy" className="block hover:text-ink">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

export function Mark() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white" aria-hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16M12 4v16" />
      </svg>
    </span>
  );
}
