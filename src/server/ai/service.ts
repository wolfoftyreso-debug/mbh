import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { aiUsageEvents, assignments } from "@/server/db/schema";
import { audit } from "@/server/audit/log";
import { logger } from "@/server/logger";
import { AiPolicyError, assertAiAllowed, type AiDataClass } from "./policy";
import { aiGatewayConfigured, AiUnavailableError, chat, transcribeAudio } from "./gateway";

/**
 * The ONLY entry point for AI functionality. Every feature:
 *  1. checks the assignment's AI policy for the data class it needs,
 *  2. records an AIUsageEvent (success, failure, blocked, unavailable),
 *  3. degrades gracefully (returns null) when the gateway is unavailable.
 *
 * AI never signs, never marks work as human-written, never accepts
 * responsibility and never replaces professional work.
 */

type AssignmentRow = typeof assignments.$inferSelect;

async function record(input: {
  userId: string | null;
  assignmentId: string | null;
  feature: string;
  dataClass: AiDataClass;
  policy: AssignmentRow["aiPolicy"] | null;
  status: "SUCCESS" | "FAILED" | "BLOCKED_BY_POLICY" | "UNAVAILABLE";
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  error?: string;
}) {
  try {
    await db.insert(aiUsageEvents).values({
      userId: input.userId,
      assignmentId: input.assignmentId,
      feature: input.feature,
      dataClass: input.dataClass,
      policyAtTime: input.policy,
      status: input.status,
      model: input.model ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      error: input.error?.slice(0, 200),
    });
  } catch (err) {
    logger.error("ai_usage_record_failed", { error: (err as Error).message });
  }
}

async function guarded<T>(opts: { userId: string | null; assignment: AssignmentRow | null; feature: string; dataClass: AiDataClass }, fn: () => Promise<{ value: T; model: string; inputTokens: number | null; outputTokens: number | null }>): Promise<T | null> {
  const policy = opts.assignment?.aiPolicy ?? null;
  const assignmentId = opts.assignment?.id ?? null;
  if (opts.assignment) {
    try {
      assertAiAllowed(opts.assignment, opts.dataClass);
    } catch (err) {
      if (err instanceof AiPolicyError) {
        await record({ userId: opts.userId, assignmentId, feature: opts.feature, dataClass: opts.dataClass, policy, status: "BLOCKED_BY_POLICY", error: err.message });
        await audit({ actorType: "SYSTEM", actorUserId: opts.userId, action: "AI_REQUEST_BLOCKED", entityType: "assignment", entityId: assignmentId ?? "none", assignmentId, metadata: { feature: opts.feature, dataClass: opts.dataClass } });
        throw err;
      }
      throw err;
    }
  }
  if (!aiGatewayConfigured()) {
    await record({ userId: opts.userId, assignmentId, feature: opts.feature, dataClass: opts.dataClass, policy, status: "UNAVAILABLE", error: "not configured" });
    return null;
  }
  try {
    const result = await fn();
    await record({ userId: opts.userId, assignmentId, feature: opts.feature, dataClass: opts.dataClass, policy, status: "SUCCESS", model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    await audit({ actorType: "SYSTEM", actorUserId: opts.userId, action: "AI_REQUEST", entityType: "assignment", entityId: assignmentId ?? "none", assignmentId, metadata: { feature: opts.feature, dataClass: opts.dataClass, model: result.model } });
    return result.value;
  } catch (err) {
    const status = err instanceof AiUnavailableError ? "UNAVAILABLE" : "FAILED";
    await record({ userId: opts.userId, assignmentId, feature: opts.feature, dataClass: opts.dataClass, policy, status, error: (err as Error).message });
    return null;
  }
}

function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export interface BriefSuggestion {
  title: string;
  summary: string;
  suggestedService: string;
  suggestedLanguage: string | null;
  suggestedDomainPath: string | null;
  domainRequirement: "NOT_REQUIRED" | "PREFERRED" | "REQUIRED";
  rationale: string;
}

export const aiService = {
  /**
   * Suggests a structured brief from a customer's free-text description
   * (before an assignment exists, so only the customer's own draft text is sent).
   * Used to help the customer buy the minimum appropriate competence.
   */
  async suggestBrief(userId: string, description: string, options: { categories: string[]; domainPaths: string[]; languages: string[] }): Promise<BriefSuggestion | null> {
    return guarded({ userId, assignment: null, feature: "suggest_brief", dataClass: "CONTENT" }, async () => {
      const system = `You help a customer describe an assignment for a marketplace of verified human professionals. Respond with JSON only: {"title","summary","suggestedService","suggestedLanguage","suggestedDomainPath","domainRequirement","rationale"}.
Rules: Do not over-qualify. If the customer already possesses the subject knowledge (e.g. they own the business or recorded their own explanation), set domainRequirement to NOT_REQUIRED and recommend a language professional. Recommend a domain reviewer only when the customer lacks the expertise or explicitly asks for a technical check.
suggestedService must be one of: ${options.categories.join(", ")}. suggestedDomainPath must be one of: ${options.domainPaths.join(", ")} or null. suggestedLanguage must be an ISO code from: ${options.languages.join(", ")} or null.`;
      const res = await chat(system, description.slice(0, 6000), { json: true, maxTokens: 500 });
      const parsed = parseJson<BriefSuggestion>(res.text);
      if (!parsed) throw new Error("Unparseable AI response");
      return { value: parsed, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    });
  },

  /** Metadata-only categorization for matching; never sends content. */
  async categorizeMetadata(userId: string, assignment: AssignmentRow, options: { domainPaths: string[] }): Promise<{ domainPath: string | null; keywords: string[] } | null> {
    return guarded({ userId, assignment, feature: "categorize_metadata", dataClass: "METADATA" }, async () => {
      const system = `Classify an assignment title into a domain taxonomy. Respond with JSON: {"domainPath": string|null, "keywords": string[]}. domainPath must be one of: ${options.domainPaths.join(", ")} or null.`;
      const res = await chat(system, `Title: ${assignment.title}\nCategory hint: ${assignment.template}`, { json: true, maxTokens: 200 });
      const parsed = parseJson<{ domainPath: string | null; keywords: string[] }>(res.text);
      if (!parsed) throw new Error("Unparseable AI response");
      return { value: parsed, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    });
  },

  /** Quality-control hints for a professional on their own draft (content class). */
  async qualityHints(userId: string, assignment: AssignmentRow, text: string): Promise<string[] | null> {
    return guarded({ userId, assignment, feature: "quality_hints", dataClass: "CONTENT" }, async () => {
      const system = `You assist a human professional editor. List up to 8 short, concrete hints about obvious grammar slips, unclear sentences or inconsistent terminology in the text. Do not rewrite the text. Respond with JSON: {"hints": string[]}.`;
      const res = await chat(system, text.slice(0, 12000), { json: true, maxTokens: 600 });
      const parsed = parseJson<{ hints: string[] }>(res.text);
      if (!parsed) throw new Error("Unparseable AI response");
      return { value: parsed.hints.slice(0, 8), model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    });
  },

  /** Short summary of a source transcript for the professional's brief (content class). */
  async summarizeSource(userId: string, assignment: AssignmentRow, text: string): Promise<string | null> {
    return guarded({ userId, assignment, feature: "summarize_source", dataClass: "CONTENT" }, async () => {
      const system = "Summarize the following source material in at most 8 bullet points for a professional writer. Preserve facts exactly; do not add information.";
      const res = await chat(system, text.slice(0, 16000), { maxTokens: 500 });
      return { value: res.text, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    });
  },

  /**
   * Transcription is source processing, not authorship. The professional
   * always receives both the recording and the transcript.
   */
  async transcribe(userId: string, assignment: AssignmentRow, audio: { bytes: Uint8Array; filename: string; mimeType: string }, language?: string): Promise<string | null> {
    return guarded({ userId, assignment, feature: "transcribe", dataClass: "CONTENT" }, async () => {
      const res = await transcribeAudio(audio.bytes, audio.filename, audio.mimeType, language);
      return { value: res.text, model: res.model, inputTokens: null, outputTokens: null };
    });
  },

  /** Moderation of public profile text (no assignment content involved). */
  async moderateProfileText(userId: string, text: string): Promise<{ flagged: boolean; reason: string | null } | null> {
    return guarded({ userId, assignment: null, feature: "moderate_profile", dataClass: "CONTENT" }, async () => {
      const system = 'Flag text that contains hate, harassment, explicit content, scams or fabricated credentials claims (e.g. "certified by the platform"). Respond with JSON {"flagged": boolean, "reason": string|null}.';
      const res = await chat(system, text.slice(0, 4000), { json: true, maxTokens: 120 });
      const parsed = parseJson<{ flagged: boolean; reason: string | null }>(res.text);
      if (!parsed) throw new Error("Unparseable AI response");
      return { value: parsed, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
    });
  },
};

export async function loadAssignmentForAi(assignmentId: string): Promise<AssignmentRow | null> {
  const [row] = await db.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
  return row ?? null;
}
