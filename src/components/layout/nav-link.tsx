"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/")) || (href === "/assignments" && pathname.startsWith("/assignments"));
  return (
    <Link href={href} className={cn("whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
      {children}
    </Link>
  );
}
