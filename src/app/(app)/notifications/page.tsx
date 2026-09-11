import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { PageHeader, EmptyState } from "@/components/ui/card";
import { MarkAllReadButton } from "@/components/settings/forms";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getT } from "@/server/i18n";

export default async function NotificationsPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getT();
  const rows = await db.select().from(notifications).where(and(eq(notifications.userId, viewer.userId), eq(notifications.channel, "IN_APP"))).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("ntf.title")} action={<MarkAllReadButton label={t("ntf.markRead")} />} />
      {rows.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map((n) => (
            <li key={n.id} className={cn("px-4 py-3 text-sm", !n.readAt && "bg-accent-soft/30")}>
              {n.link ? <Link href={n.link} className="font-medium hover:underline">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
              <p className="text-ink-2">{n.body}</p>
              <p className="text-xs text-ink-3">{formatDateTime(n.createdAt, locale === "sv" ? "sv-SE" : "en-GB")}</p>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={t("ntf.none")} />}
    </div>
  );
}
