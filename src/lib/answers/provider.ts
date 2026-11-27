import { readEnv } from "@/lib/env";
import {
  deterministicDraft,
  type AnswerDraft,
} from "./deterministic";

export type SemanticInput = {
  prompt: string;
  answer: string;
  aliases: readonly string[];
  response: string;
};

export type AnswerProvider = {
  name: "openai" | "deterministic";
  generate(input: { prompt: string; answer: string }): Promise<AnswerDraft>;
  judgeEquivalent?(input: SemanticInput): Promise<boolean>;
};

const deterministicProvider: AnswerProvider = {
  name: "deterministic",
  async generate(input) {
    return deterministicDraft(input);
  },
};

function cleanList(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const cleaned: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > maxLength) continue;
    cleaned.push(trimmed);
    if (cleaned.length >= limit) break;
  }
  return cleaned;
}

function parseModelPayload(payload: unknown): AnswerDraft | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const accepted = cleanList(record.accepted, 8, 80);
  const bonusPrompt =
    typeof record.bonusPrompt === "string" ? record.bonusPrompt.trim() : "";
  const bonusAnswers = cleanList(record.bonusAnswers, 6, 80);
  return {
    accepted,
    bonus:
      bonusPrompt && bonusAnswers.length > 0
        ? { prompt: bonusPrompt.slice(0, 160), answers: bonusAnswers }
        : null,
  };
}

function createOpenAiProvider(apiKey: string): AnswerProvider {
  return {
    name: "openai",
    async judgeEquivalent(input) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(2_500),
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  'You grade one trivia answer. Return JSON {"equivalent": true or false}. True only when the response is the same answer as the expected answer or a listed alias: a synonym, a common name, or a spelling a trivia host would accept. False for related-but-different answers, partial answers, and guesses.',
              },
              {
                role: "user",
                content: JSON.stringify({
                  prompt: input.prompt,
                  expected: input.answer,
                  aliases: input.aliases,
                  response: input.response,
                }),
              },
            ],
          }),
        });
        if (!response.ok) return false;
        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) return false;
        const parsed = JSON.parse(content) as { equivalent?: unknown };
        return parsed.equivalent === true;
      } catch {
        return false;
      }
    },
    async generate(input) {
      const fallback = deterministicDraft(input);
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You write trivia grading aids. Return JSON with keys accepted (array of strings), bonusPrompt (string or empty), and bonusAnswers (array of strings). accepted lists alternate fully-correct responses only: last names of people, common short forms, and spelling variants. Do not repeat the canonical answer and do not include wrong answers. If a fair follow-up exists, bonusPrompt asks one short question whose answer is bonusAnswers. Otherwise leave the bonus empty.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  prompt: input.prompt,
                  answer: input.answer,
                }),
              },
            ],
          }),
        });
        if (!response.ok) return fallback;
        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) return fallback;
        const parsed = parseModelPayload(JSON.parse(content) as unknown);
        if (!parsed) return fallback;
        return {
          accepted: parsed.accepted.length > 0 ? parsed.accepted : fallback.accepted,
          bonus: parsed.bonus ?? fallback.bonus,
        };
      } catch {
        return fallback;
      }
    },
  };
}

export function createAnswerProvider(): AnswerProvider {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return deterministicProvider;
  return createOpenAiProvider(apiKey);
}
