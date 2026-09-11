"use server";
import { verifyAgainstRecord } from "@/server/domain/signing/service";
import { PUBLIC_RECORD_ID_PATTERN } from "@/lib/ids";
import { rateLimit } from "@/server/security/rate-limit";
import { safeAction, type ActionResult, ValidationError } from "@/server/security/errors";
import { requestContext } from "@/server/security/request";

export async function verifyRecordAction(publicId: string, formData: FormData): Promise<ActionResult<{ result: "MATCH" | "NO_MATCH" | "NOT_AVAILABLE"; suppliedHash: string | null }>> {
  return safeAction("verifyRecord", async () => {
    if (!PUBLIC_RECORD_ID_PATTERN.test(publicId)) throw new ValidationError("Invalid record identifier");
    const req = await requestContext();
    await rateLimit(`verify:${req.ipHash ?? "anon"}`, 30, 600);
    const text = formData.get("text");
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 25 * 1024 * 1024) throw new ValidationError("File too large");
      return verifyAgainstRecord(publicId, { fileBytes: new Uint8Array(await file.arrayBuffer()) });
    }
    if (typeof text === "string" && text.trim()) {
      if (text.length > 2_000_000) throw new ValidationError("Text too long");
      return verifyAgainstRecord(publicId, { text });
    }
    throw new ValidationError("Paste text or choose a file to verify");
  });
}
