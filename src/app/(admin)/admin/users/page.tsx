import { and, eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/server/auth/session";
import { listUsers } from "@/server/domain/admin/service";
import { db } from "@/server/db";
import { privacyRequests } from "@/server/db/schema";
import { PageHeader } from "@/components/ui/card";
import { Badge, VerificationBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { UserAdminControls } from "@/components/admin/forms";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const viewer = await requireAdmin();
  const sp = await searchParams;
  const users = await listUsers(viewer, sp.q ?? null, Number(sp.page ?? 1));
  const pendingDeletions = users.length ? await db.select({ userId: privacyRequests.userId }).from(privacyRequests).where(and(inArray(privacyRequests.userId, users.map((u) => u.id)), eq(privacyRequests.type, "ACCOUNT_DELETION"), eq(privacyRequests.status, "PENDING"))) : [];
  return (
    <div>
      <PageHeader title="Users" />
      <form className="mb-4 flex gap-2"><Input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or e-mail" className="max-w-sm" /><Button type="submit" variant="outline">Search</Button></form>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-4 py-2">User</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Professional</th><th className="px-4 py-2">Joined</th><th className="px-4 py-2">Actions</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3"><p className="font-medium">{u.name}</p><p className="text-xs text-ink-3">{u.email}</p>{u.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}{u.deletedAt ? <Badge>Deleted</Badge> : null}</td>
                <td className="px-4 py-3"><Badge>{u.platformRole}</Badge></td>
                <td className="px-4 py-3">{u.verificationStatus ? <VerificationBadge status={u.verificationStatus} withLink={false} /> : <span className="text-ink-3">—</span>}</td>
                <td className="px-4 py-3 text-ink-3">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">{u.id !== viewer.userId ? <UserAdminControls userId={u.id} suspended={Boolean(u.suspendedAt)} platformRole={u.platformRole} profileId={u.professionalProfileId} verificationStatus={u.verificationStatus} isSuperAdmin={viewer.platformRole === "SUPER_ADMIN"} deletionPending={pendingDeletions.some((d) => d.userId === u.id)} /> : <span className="text-xs text-ink-3">You</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
