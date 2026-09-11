import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { authorizeFileRead, readFileBytes, recordFileAccess } from "@/server/domain/files/service";

export const runtime = "nodejs";

/**
 * All file reads go through here. There are no public object URLs: the route
 * authorizes the viewer for the specific attachment and streams the bytes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  try {
    const { attachment, public: isPublic } = await authorizeFileRead(viewer, id);
    const bytes = await readFileBytes(attachment);
    if (!bytes) return new NextResponse("Not found", { status: 404 });
    if (viewer && !isPublic) await recordFileAccess(viewer, attachment);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const inlineSafe = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf" || attachment.mimeType.startsWith("audio/") || attachment.mimeType.startsWith("video/");
    const disposition = `${download || !inlineSafe ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`;
    return new NextResponse(bytes.slice().buffer as ArrayBuffer, {
      headers: {
        "content-type": attachment.mimeType,
        "content-length": String(bytes.byteLength),
        "content-disposition": disposition,
        "cache-control": isPublic ? "public, max-age=3600" : "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
      },
    });
  } catch (err) {
    const e = err as Error & { status?: number };
    // Anti-enumeration: unauthorized and missing files look identical.
    return new NextResponse(e.status === 403 ? "Forbidden" : "Not found", { status: e.status === 403 ? 403 : 404 });
  }
}
