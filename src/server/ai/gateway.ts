import { env } from "@/lib/config/env";
import { logger } from "@/server/logger";

/**
 * Thin client for an OpenAI-compatible AI Gateway (e.g. Vercel AI Gateway).
 * Only the AI service layer may import this module.
 */
export interface ChatResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export class AiUnavailableError extends Error {
  status = 503;
  constructor(message = "AI features are currently unavailable") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function aiGatewayConfigured(): boolean {
  return env.aiConfigured;
}

export async function chat(system: string, user: string, opts: { model?: string; maxTokens?: number; json?: boolean; timeoutMs?: number } = {}): Promise<ChatResult> {
  if (!env.aiConfigured) throw new AiUnavailableError("AI Gateway is not configured");
  const model = opts.model ?? env.AI_DEFAULT_MODEL ?? "openai/gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${env.AI_GATEWAY_URL!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: opts.maxTokens ?? 800,
        temperature: 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("ai_gateway_error", { status: res.status });
      throw new AiUnavailableError(`AI Gateway responded with ${res.status}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      model: json.model ?? model,
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
    };
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    logger.warn("ai_gateway_failed", { error: (err as Error).message });
    throw new AiUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribeAudio(bytes: Uint8Array, filename: string, mimeType: string, language?: string): Promise<{ text: string; model: string }> {
  if (!env.aiConfigured) throw new AiUnavailableError("AI Gateway is not configured");
  const model = env.AI_TRANSCRIPTION_MODEL ?? "openai/whisper-1";
  const form = new FormData();
  form.append("file", new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType }), filename);
  form.append("model", model);
  if (language) form.append("language", language);
  const res = await fetch(`${env.AI_GATEWAY_URL!.replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.AI_GATEWAY_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new AiUnavailableError(`Transcription failed with ${res.status}`);
  const json = (await res.json()) as { text?: string };
  return { text: json.text ?? "", model };
}
