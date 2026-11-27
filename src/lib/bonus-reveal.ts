import { normalizeFillIn } from "@/lib/grading";

function bonusWords(bonusAnswers: readonly string[]): string[] {
  const words = new Set<string>();
  for (const bonus of bonusAnswers) {
    for (const word of normalizeFillIn(bonus).split(" ")) {
      if (word.length >= 3) words.add(word);
    }
  }
  return [...words];
}

/** Canonical answer with the bonus words removed, so a pending bonus is not spoiled. */
export function answerWithoutBonus(
  answer: string,
  bonusAnswers: readonly string[],
): string {
  const hidden = new Set(bonusWords(bonusAnswers));
  if (hidden.size === 0) return answer;
  const kept = answer
    .split(/\s+/)
    .filter((word) => {
      const key = normalizeFillIn(word);
      return key.length > 0 && !hidden.has(key);
    });
  const text = kept.join(" ").replace(/^[,.;:—-]+/, "").trim();
  return text.length > 0 ? text : "____";
}

/** Replace bonus phrases in explanation text until the bonus is resolved. */
export function maskBonusText(
  text: string | null,
  bonusAnswers: readonly string[],
): string | null {
  if (!text) return text;
  const phrases = [...bonusAnswers]
    .map((bonus) => bonus.trim())
    .filter((bonus) => normalizeFillIn(bonus).length >= 3)
    .sort((left, right) => right.length - left.length);
  let result = text;
  for (const phrase of phrases) {
    const parts = phrase
      .split(/\s+/)
      .filter((word) => normalizeFillIn(word).length >= 3)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (parts.length === 0) continue;
    result = result.replace(new RegExp(parts.join("[\\s'’.-]+"), "gi"), "____");
  }
  return result.replace(/(?:____\s*){2,}/g, "____ ").replace(/\s+/g, " ").trim();
}

export function containedBonusNote(prompt: string | null, points: number): string {
  if (prompt && /first name/i.test(prompt)) return `Full name! +${points} bonus`;
  return `Already in your answer! +${points} bonus`;
}
