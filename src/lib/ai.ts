import Anthropic from "@anthropic-ai/sdk";
import { invoke } from "@tauri-apps/api/core";

export type ModelTier = "haiku" | "sonnet" | "opus";

export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-7",
};

export const MODEL_LABELS: Record<ModelTier, string> = {
  haiku: "Haiku 4.5 — default, cheap, fast",
  sonnet: "Sonnet 4.6 — use for non-trivial work",
  opus: "Opus 4.7 — reserve for hard problems",
};

// Adaptive thinking is Opus + Sonnet 4.6 only — Haiku 4.5 will 400 if sent.
function thinkingFor(tier: ModelTier): Anthropic.ThinkingConfigParam | undefined {
  return tier === "haiku" ? undefined : { type: "adaptive" };
}

export async function getApiKey(): Promise<string | null> {
  try {
    return await invoke<string | null>("ai_get_api_key");
  } catch (e) {
    console.error("[ai] get_api_key failed", e);
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  try {
    await invoke("ai_set_api_key", { key });
  } catch (e) {
    console.error("[ai] set_api_key failed", e);
    throw e;
  }
}

export async function clearApiKey(): Promise<void> {
  await invoke("ai_clear_api_key");
}

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are a document analyst embedded in HermosaPDF. Ground every answer in the document's actual contents. Be specific — cite concrete facts, numbers, dates, and names rather than general summaries. If the document doesn't contain an answer, say so plainly instead of speculating.";

function buildSystem(docText: string): Anthropic.TextBlockParam[] {
  // cache_control on the document block means repeat calls with the same
  // document hit the cache (~90% cheaper on the cached portion).
  return [
    { type: "text", text: SYSTEM_PROMPT },
    {
      type: "text",
      text: `<document>\n${docText}\n</document>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function extractText(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function stripCodeFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export async function summarize(
  client: Anthropic,
  docText: string,
  tier: ModelTier,
): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL_IDS[tier],
    max_tokens: 8000,
    thinking: thinkingFor(tier),
    system: buildSystem(docText),
    messages: [
      {
        role: "user",
        content:
          "Summarize the document in 3–5 tight paragraphs. Lead with what the document is and who the parties are. Call out key dates, amounts, obligations, and any unusual clauses. End with a one-line bottom-line takeaway.",
      },
    ],
  });
  return extractText(resp);
}

export async function askQuestion(
  client: Anthropic,
  docText: string,
  history: ChatMessage[],
  question: string,
  tier: ModelTier,
): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL_IDS[tier],
    max_tokens: 8000,
    thinking: thinkingFor(tier),
    system: buildSystem(docText),
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ],
  });
  return extractText(resp);
}

export async function extractFields(
  client: Anthropic,
  docText: string,
  fields: string[],
  tier: ModelTier,
): Promise<Record<string, string | null>> {
  const fieldList = fields.map((f) => `- ${f}`).join("\n");
  const resp = await client.messages.create({
    model: MODEL_IDS[tier],
    max_tokens: 2048,
    system: buildSystem(docText),
    messages: [
      {
        role: "user",
        content: `Extract the following fields from the document. Respond with a single JSON object whose keys are the field names (use the exact names given) and whose values are the extracted string, or null if the field isn't present. Do not wrap in code fences. Do not add commentary.\n\nFields:\n${fieldList}`,
      },
    ],
  });
  const raw = extractText(resp);
  const cleaned = stripCodeFences(raw);
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | null>;
    }
  } catch {
    // fall through
  }
  return { __raw: raw };
}

export interface RedactSuggestion {
  text: string;
  reason: string;
}

export async function redactSuggestions(
  client: Anthropic,
  docText: string,
  tier: ModelTier,
): Promise<RedactSuggestion[]> {
  const resp = await client.messages.create({
    model: MODEL_IDS[tier],
    max_tokens: 4096,
    system: buildSystem(docText),
    messages: [
      {
        role: "user",
        content:
          'Identify passages in the document that likely contain personally identifiable or sensitive information: full names, addresses, phone numbers, email addresses, SSNs, account numbers, dates of birth, signatures, license or ID numbers, credit card numbers. Respond with a single JSON array of objects, each with "text" (the exact passage copied verbatim from the document) and "reason" (one short phrase explaining why it is sensitive). Do not wrap in code fences. Do not add commentary.',
      },
    ],
  });
  const cleaned = stripCodeFences(extractText(resp));
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (x): x is RedactSuggestion =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as { text?: unknown }).text === "string" &&
          typeof (x as { reason?: unknown }).reason === "string",
      );
    }
  } catch {
    // fall through
  }
  return [];
}
