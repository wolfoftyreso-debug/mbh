import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-2 border border-accent",
  secondary: "bg-surface-2 text-ink hover:bg-line border border-line",
  outline: "bg-transparent text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "primary", size = "md", className, href, ...props }: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link href={href} className={buttonClass(variant, size, className)} {...props} />;
}
