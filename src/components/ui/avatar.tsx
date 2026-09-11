import { cn, initials } from "@/lib/utils";

export function Avatar({ name, photoId, image, size = 40, className }: { name: string; photoId?: string | null; image?: string | null; size?: number; className?: string }) {
  const src = photoId ? `/api/files/${photoId}` : image ?? null;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-ink-2", className)} style={{ width: size, height: size, fontSize: Math.max(11, size / 2.6) }} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span className="font-medium">{initials(name)}</span>
      )}
    </span>
  );
}
