import { normalizeFillIn } from "@/lib/grading";

export type BonusDraft = {
  prompt: string;
  answers: string[];
};

export type AnswerDraft = {
  accepted: string[];
  bonus: BonusDraft | null;
};

const NAME_PART = /^[\p{Lu}][\p{L}'’-]*$/u;
const PERSON_CUE =
  /\b(who|scientist|painter|artist|author|writer|composer|named|awarded|inventor|philosopher|playwright|director)\b/i;
const BLOCKED_FIRST = new Set([
  "big",
  "cape",
  "east",
  "el",
  "fort",
  "good",
  "great",
  "lake",
  "las",
  "los",
  "mount",
  "new",
  "north",
  "old",
  "port",
  "rio",
  "san",
  "santa",
  "south",
  "st",
  "saint",
  "the",
  "united",
  "west",
]);
const PARTICLES = new Set([
  "bin",
  "da",
  "de",
  "del",
  "della",
  "di",
  "du",
  "ibn",
  "la",
  "le",
  "van",
  "von",
]);

const SHORT_FORMS: Record<string, readonly string[]> = {
  "united states": ["US", "USA", "U.S."],
  "united states of america": ["US", "USA"],
  "united kingdom": ["UK", "U.K."],
  "new york city": ["NYC"],
  "los angeles": ["LA", "L.A."],
};

function partsOf(answer: string): string[] {
  return answer.trim().split(/\s+/).filter((part) => part.length > 0);
}

function isPerson(answer: string, prompt: string): boolean {
  if (!PERSON_CUE.test(prompt)) return false;
  const parts = partsOf(answer);
  if (parts.length < 2 || parts.length > 4) return false;
  if (BLOCKED_FIRST.has(parts[0]?.toLowerCase() ?? "")) return false;
  const names = parts.filter((part) => !PARTICLES.has(part.toLowerCase()));
  if (names.length < 2) return false;
  return parts.every(
    (part) => PARTICLES.has(part.toLowerCase()) || NAME_PART.test(part),
  );
}

function digraphVariant(answer: string): string | null {
  if (!/[äöüÄÖÜß]/.test(answer)) return null;
  return answer
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ß", "ss");
}

export function mergeAccepted(canonical: string, values: string[]): string[] {
  const canonicalKey = normalizeFillIn(canonical);
  const seen = new Set<string>();
  const accepted: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = normalizeFillIn(trimmed);
    if (!key || key === canonicalKey || seen.has(key)) continue;
    seen.add(key);
    accepted.push(trimmed);
  }
  return accepted;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function targetBonusCount(eligible: number): number {
  if (eligible <= 0) return 0;
  const ideal = Math.round(eligible * 0.25);
  const min = Math.ceil(eligible * 0.2);
  const max = Math.floor(eligible * 0.3);
  if (max < min) return Math.min(eligible, ideal);
  return Math.min(max, Math.max(min, ideal));
}

export function deterministicDraft(input: {
  prompt: string;
  answer: string;
}): AnswerDraft {
  const parts = partsOf(input.answer);
  const accepted: string[] = [];
  let bonus: BonusDraft | null = null;

  if (isPerson(input.answer, input.prompt)) {
    const last = parts[parts.length - 1] ?? "";
    const previous = parts[parts.length - 2];
    if (previous && PARTICLES.has(previous.toLowerCase())) {
      accepted.push(`${previous} ${last}`, last);
    } else if (last) {
      accepted.push(last);
    }
    const first = parts.find((part) => !PARTICLES.has(part.toLowerCase()));
    if (first) {
      bonus = { prompt: "What was their first name?", answers: [first] };
    }
  }

  const saint = /^(saint|st\.?)\s+(.+)$/i.exec(input.answer.trim());
  if (saint?.[2]) {
    accepted.push(`St. ${saint[2]}`, `St ${saint[2]}`);
    if (!bonus) {
      bonus = { prompt: "Which saint?", answers: [saint[2].trim()] };
    }
  }

  const variant = digraphVariant(input.answer);
  if (variant) accepted.push(variant);

  const shorts = SHORT_FORMS[normalizeFillIn(input.answer)];
  if (shorts) accepted.push(...shorts);

  if (!bonus && parts.length === 2 && parts[1]) {
    bonus = { prompt: "What is the second word?", answers: [parts[1]] };
  } else if (!bonus && parts.length >= 3) {
    const last = parts[parts.length - 1];
    if (last && !PARTICLES.has(last.toLowerCase())) {
      bonus = { prompt: "What is the last word?", answers: [last] };
    }
  }

  return {
    accepted: mergeAccepted(input.answer, accepted),
    bonus: bonus
      ? {
          prompt: bonus.prompt,
          answers: mergeAccepted(input.answer, bonus.answers),
        }
      : null,
  };
}

export type PlannedAnswers = {
  id: string;
  accepted: string[];
  bonusPrompt: string | null;
  bonusAnswers: string[];
};

type DraftWithPriority = AnswerDraft & { priority: number };

function draftWithPriority(input: {
  prompt: string;
  answer: string;
}): DraftWithPriority {
  const draft = deterministicDraft(input);
  const person = isPerson(input.answer, input.prompt);
  const saint = /^(saint|st\.?)\s+/i.test(input.answer.trim());
  return {
    ...draft,
    priority: person ? 0 : saint ? 1 : 2,
  };
}

export function chooseBonusIds(
  candidates: readonly { id: string; priority: number }[],
  eligibleCount: number,
): string[] {
  const target = Math.min(targetBonusCount(eligibleCount), candidates.length);
  const ranked = [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    const delta = hashSeed(left.id) - hashSeed(right.id);
    if (delta !== 0) return delta;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return ranked.slice(0, target).map((item) => item.id);
}

export function planDeterministicAnswers(
  questions: readonly { id: string; prompt: string; answer: string }[],
): PlannedAnswers[] {
  const drafts = questions.map((question) => ({
    question,
    draft: draftWithPriority(question),
  }));
  const selected = new Set(
    chooseBonusIds(
      drafts
        .filter((item) => item.draft.bonus && item.draft.bonus.answers.length > 0)
        .map((item) => ({ id: item.question.id, priority: item.draft.priority })),
      drafts.length,
    ),
  );
  return drafts.map(({ question, draft }) => ({
    id: question.id,
    accepted: draft.accepted,
    bonusPrompt: selected.has(question.id) ? (draft.bonus?.prompt ?? null) : null,
    bonusAnswers: selected.has(question.id) ? (draft.bonus?.answers ?? []) : [],
  }));
}
