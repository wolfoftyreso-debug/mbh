import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, type Tx } from "@/server/db";
import { assignmentParticipants, assignments, attachments, messageAttachments, messages, users } from "@/server/db/schema";
import { audit } from "@/server/audit/log";
import { notifyMany } from "@/server/notifications/service";
import { rateLimit } from "@/server/security/rate-limit";
import { ValidationError } from "@/server/security/errors";

/** Adds a visually distinct system event to the assignment conversation. */
export async function systemMessage(assignmentId: string, body: string, metadata: Record<string, unknown> = {}, tx?: Tx): Promise<void> {
  await (tx ?? db).insert(messages).values({ assignmentId, senderUserId: null, kind: "SYSTEM", body, metadata });
}

export async function activeParticipantUserIds(assignmentId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: assignmentParticipants.userId })
    .from(assignmentParticipants)
    .where(and(eq(assignmentParticipants.assignmentId, assignmentId), isNull(assignmentParticipants.removedAt)));
  return rows.map((r) => r.userId);
}

export async function sendMessage(input: { assignmentId: string; senderUserId: string; senderName: string; body: string; attachmentIds?: string[] }): Promise<string> {
  const body = input.body.trim();
  if (!body && !(input.attachmentIds?.length)) throw new ValidationError("Message cannot be empty");
  if (body.length > 20000) throw new ValidationError("Message is too long");
  await rateLimit(`msg:${input.senderUserId}`, 60, 60);

  const attachmentIds = input.attachmentIds ?? [];
  if (attachmentIds.length) {
    const owned = await db
      .select({ id: attachments.id })
      .from(attachments)
      .where(and(inArray(attachments.id, attachmentIds), eq(attachments.ownerUserId, input.senderUserId), eq(attachments.assignmentId, input.assignmentId)));
    if (owned.length !== attachmentIds.length) throw new ValidationError("One or more attachments are invalid");
  }

  const id = await db.transaction(async (tx) => {
    const [m] = await tx.insert(messages).values({ assignmentId: input.assignmentId, senderUserId: input.senderUserId, kind: "TEXT", body, metadata: {} }).returning({ id: messages.id });
    if (attachmentIds.length) await tx.insert(messageAttachments).values(attachmentIds.map((attachmentId) => ({ messageId: m.id, attachmentId })));
    await audit({ actorType: "USER", actorUserId: input.senderUserId, action: "MESSAGE_SENT", entityType: "message", entityId: m.id, assignmentId: input.assignmentId, metadata: { attachments: attachmentIds.length } }, tx);
    return m.id;
  });

  const [assignment] = await db.select({ title: assignments.title, publicId: assignments.publicId }).from(assignments).where(eq(assignments.id, input.assignmentId)).limit(1);
  const recipients = (await activeParticipantUserIds(input.assignmentId)).filter((u) => u !== input.senderUserId);
  if (assignment) await notifyMany(recipients, "NEW_MESSAGE", { title: assignment.title, publicId: assignment.publicId, senderName: input.senderName });
  return id;
}

export interface ConversationMessage {
  id: string;
  kind: "TEXT" | "SYSTEM";
  body: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  sender: { id: string; name: string; image: string | null } | null;
  attachments: { id: string; filename: string; mimeType: string; sizeBytes: number }[];
}

export async function listMessages(assignmentId: string): Promise<ConversationMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      kind: messages.kind,
      body: messages.body,
      metadata: messages.metadata,
      createdAt: messages.createdAt,
      senderId: users.id,
      senderName: users.name,
      senderImage: users.image,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderUserId))
    .where(eq(messages.assignmentId, assignmentId))
    .orderBy(asc(messages.createdAt))
    .limit(500);
  const ids = rows.map((r) => r.id);
  const files = ids.length
    ? await db
        .select({ messageId: messageAttachments.messageId, id: attachments.id, filename: attachments.filename, mimeType: attachments.mimeType, sizeBytes: attachments.sizeBytes })
        .from(messageAttachments)
        .innerJoin(attachments, eq(attachments.id, messageAttachments.attachmentId))
        .where(and(inArray(messageAttachments.messageId, ids), isNull(attachments.deletedAt)))
    : [];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    metadata: r.metadata,
    createdAt: r.createdAt,
    sender: r.senderId ? { id: r.senderId, name: r.senderName ?? "", image: r.senderImage ?? null } : null,
    attachments: files.filter((f) => f.messageId === r.id).map(({ id, filename, mimeType, sizeBytes }) => ({ id, filename, mimeType, sizeBytes })),
  }));
}
