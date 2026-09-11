"use client";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="mt-3 w-full rounded-md border border-line px-3 py-1.5 text-xs text-ink-2 hover:bg-surface-2"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
    >
      Sign out
    </button>
  );
}
