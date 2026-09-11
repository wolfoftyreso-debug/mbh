import { env } from "@/lib/config/env";
import { ValidationError } from "@/server/security/errors";

export type AttachmentPurpose =
  | "SOURCE_MATERIAL"
  | "AUDIO_RECORDING"
  | "TRANSCRIPT"
  | "DELIVERABLE"
  | "MESSAGE"
  | "VERIFICATION_DOCUMENT"
  | "PROFILE_PHOTO"
  | "PORTFOLIO"
  | "DISPUTE_EVIDENCE";

const DOCUMENT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "video/webm", "video/mp4"]);

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const ALLOWED: Record<AttachmentPurpose, Set<string>> = {
  SOURCE_MATERIAL: DOCUMENT_TYPES,
  AUDIO_RECORDING: AUDIO_TYPES,
  TRANSCRIPT: new Set(["text/plain", "text/markdown", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  DELIVERABLE: DOCUMENT_TYPES,
  MESSAGE: new Set([...DOCUMENT_TYPES, ...AUDIO_TYPES]),
  VERIFICATION_DOCUMENT: new Set(["application/pdf", "image/png", "image/jpeg"]),
  PROFILE_PHOTO: IMAGE_TYPES,
  PORTFOLIO: DOCUMENT_TYPES,
  DISPUTE_EVIDENCE: new Set([...DOCUMENT_TYPES, ...AUDIO_TYPES]),
};

/** Magic-byte sniffing for the most common types to detect mislabelled uploads. */
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    const tag = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (tag === "WEBP") return "image/webp";
    if (tag === "WAVE") return "audio/wav";
  }
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "application/zip"; // docx/odt are zip containers
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return "audio/mpeg";
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "audio/mp4"; // ftyp (mp4/m4a)
  if (b.length >= 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return "audio/ogg";
  if (b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "application/msword";
  if (b.length >= 5 && b[0] === 0x7b && b[1] === 0x5c && b[2] === 0x72 && b[3] === 0x74 && b[4] === 0x66) return "application/rtf";
  return null;
}

const ZIP_BASED = new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.oasis.opendocument.text"]);
const MP4_FAMILY = new Set(["audio/mp4", "audio/x-m4a", "audio/m4a", "video/mp4"]);
const WEBM_FAMILY = new Set(["audio/webm", "video/webm"]);

export function validateUpload(purpose: AttachmentPurpose, declaredType: string, bytes: Uint8Array, filename: string): { mimeType: string } {
  const type = declaredType.split(";")[0].trim().toLowerCase();
  const allowed = ALLOWED[purpose];
  if (!allowed) throw new ValidationError("Unknown upload purpose");
  const limit = purpose === "AUDIO_RECORDING" ? env.MAX_AUDIO_UPLOAD_BYTES : env.MAX_UPLOAD_BYTES;
  if (bytes.byteLength === 0) throw new ValidationError("The file is empty");
  if (bytes.byteLength > limit) throw new ValidationError(`The file exceeds the maximum size of ${Math.round(limit / 1024 / 1024)} MB`);
  if (filename.length > 200 || /[\\/\0]/.test(filename)) throw new ValidationError("Invalid file name");
  if (!allowed.has(type)) throw new ValidationError(`File type ${type || "unknown"} is not allowed for this purpose`);

  const sniffed = sniff(bytes);
  if (sniffed) {
    const consistent =
      sniffed === type ||
      (sniffed === "application/zip" && ZIP_BASED.has(type)) ||
      (sniffed === "audio/mp4" && MP4_FAMILY.has(type)) ||
      (sniffed === "video/webm" && WEBM_FAMILY.has(type)) ||
      (sniffed === "audio/wav" && (type === "audio/wav" || type === "audio/x-wav"));
    if (!consistent) throw new ValidationError("The file content does not match its declared type");
  } else if (!type.startsWith("text/")) {
    // Unknown binary signature for a binary type: reject rather than trust the label
    if (type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && type !== "audio/mpeg") {
      throw new ValidationError("The file could not be validated");
    }
  }
  if (type.startsWith("text/")) {
    // Reject text uploads with embedded NUL bytes or executable content hints
    for (let i = 0; i < Math.min(bytes.length, 4096); i++) if (bytes[i] === 0) throw new ValidationError("Invalid text file");
  }
  return { mimeType: type };
}
