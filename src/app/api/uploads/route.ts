import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { storeUpload } from "@/server/domain/files/service";
import type { AttachmentPurpose } from "@/server/storage/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

const PURPOSES: AttachmentPurpose[] = ["SOURCE_MATERIAL", "AUDIO_RECORDING", "TRANSCRIPT", "DELIVERABLE", "MESSAGE", "VERIFICATION_DOCUMENT", "PROFILE_PHOTO", "PORTFOLIO", "DISPUTE_EVIDENCE"];

export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (viewer.suspended) return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  // Same-origin check (defense in depth alongside cookie SameSite)
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "");
  const assignmentPublicId = form.get("assignment") ? String(form.get("assignment")) : null;
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!PURPOSES.includes(purpose as AttachmentPurpose)) return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const att = await storeUpload(viewer, { purpose: purpose as AttachmentPurpose, filename: file.name || "upload", declaredType: file.type || "application/octet-stream", bytes, assignmentPublicId });
    return NextResponse.json({ id: att.id, filename: att.filename, mimeType: att.mimeType, sizeBytes: att.sizeBytes, sha256: att.sha256 });
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json({ error: e.status && e.status < 500 ? e.message : "Upload failed" }, { status: e.status ?? 500 });
  }
}
