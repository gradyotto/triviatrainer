export type GradableQuestion = {
  type: "multiple_choice" | "fill_in";
  answer: string;
  aliases?: readonly string[];
};

const ARTICLES = new Set(["a", "an", "the"]);

export function normalizeFillIn(input: string): string {
  let text = input.normalize("NFKD").replace(/\p{M}+/gu, "");
  text = text.toLowerCase();
  text = text.replace(/&/g, " and ");
  text = text.replace(/['’]/g, "");
  text = text.replace(/[.,!?;:“”"]/g, "");
  text = text.replace(/[/-]/g, " ");
  text = text.replace(/[^a-z0-9\s]/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  const words = text.split(" ").filter((word) => word.length > 0);
  let start = 0;
  while (start < words.length && ARTICLES.has(words[start] ?? "")) start += 1;
  return words.slice(start).join(" ");
}

/** Edit budget for a normalized accepted answer. Under 4 characters must match exactly. */
export function typoBudget(length: number): number {
  if (length < 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

function levenshtein(left: string, right: string, max: number): number {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > max) return max + 1;
  if (left.length === 0 || right.length === 0) {
    return Math.max(left.length, right.length);
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = current[0] ?? i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      const insert = (current[j - 1] ?? max + 1) + 1;
      const remove = (previous[j] ?? max + 1) + 1;
      const replace = (previous[j - 1] ?? max + 1) + cost;
      const value = Math.min(insert, remove, replace);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[right.length] ?? max + 1;
}

function closeEnough(given: string, expected: string): boolean {
  if (given === expected) return true;
  // Years and any answer that contains a number must match exactly after normalization.
  if (/\d/.test(given) || /\d/.test(expected)) return false;
  const budget = typoBudget(expected.length);
  if (budget === 0) return false;
  return levenshtein(given, expected, budget) <= budget;
}

const FILLER = new Set(["both"]);

// One answer, even when the text contains "and" or "&".
const SINGLE_ENTITY_SOURCES = [
  "\\btrinidad\\s+(?:and|&)\\s+tobago\\b",
  "\\bbosnia\\s+(?:and|&)\\s+herzegovina\\b",
  "\\bantigua\\s+(?:and|&)\\s+barbuda\\b",
  "\\b(?:saint|st\\.?)\\s+kitts\\s+(?:and|&)\\s+nevis\\b",
  "\\bprocter\\s*(?:and|&)\\s*gamble\\b",
  "\\bromeo\\s+(?:and|&)\\s+juliet\\b",
] as const;

// A comma between digits is a thousands separator ("1,900"), not a part break.
const PART_SEPARATOR_SOURCE =
  "\\s*(?:&|\\/|\\+|(?<!\\d),|,(?!\\d)|\\band\\b)\\s*";

function protectEntities(input: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  let text = input;
  for (const source of SINGLE_ENTITY_SOURCES) {
    text = text.replace(new RegExp(source, "gi"), (match) => {
      const token = `\u0000${tokens.length}\u0000`;
      tokens.push(match);
      return token;
    });
  }
  return { text, tokens };
}

function restoreEntities(input: string, tokens: readonly string[]): string {
  return input.replace(
    /\u0000(\d+)\u0000/g,
    (_, index: string) => tokens[Number(index)] ?? "",
  );
}

function normalizePart(input: string): string {
  const words = normalizeFillIn(input)
    .split(" ")
    .filter((word) => word.length > 0 && !FILLER.has(word));
  let start = 0;
  let end = words.length;
  while (start < end && ARTICLES.has(words[start] ?? "")) start += 1;
  while (end > start && ARTICLES.has(words[end - 1] ?? "")) end -= 1;
  return words.slice(start, end).join(" ");
}

/** Parts of a multi-part answer, or null when the text is a single answer. */
function splitAnswerParts(input: string): string[] | null {
  const { text, tokens } = protectEntities(input);
  const normalized = text
    .split(new RegExp(PART_SEPARATOR_SOURCE, "gi"))
    .map((part) => normalizePart(restoreEntities(part, tokens)))
    .filter((part) => part.length > 0);
  return normalized.length >= 2 ? normalized : null;
}

function partsMatch(given: readonly string[], slots: readonly string[][]): boolean {
  if (given.length !== slots.length) return false;
  const used = new Array<boolean>(slots.length).fill(false);

  const search = (index: number): boolean => {
    if (index === given.length) return true;
    const part = given[index] ?? "";
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      if (used[slotIndex]) continue;
      const candidates = slots[slotIndex] ?? [];
      if (!candidates.some((candidate) => closeEnough(part, candidate))) continue;
      used[slotIndex] = true;
      if (search(index + 1)) return true;
      used[slotIndex] = false;
    }
    return false;
  };

  return search(0);
}

function acceptedPartSets(
  answer: string,
  aliases: readonly string[] | undefined,
): string[][][] {
  const canonical = splitAnswerParts(answer);
  if (!canonical) return [];

  const slots = canonical.map((part) => [part]);
  const extras: string[][][] = [];

  for (const alias of aliases ?? []) {
    const aliasParts = splitAnswerParts(alias);
    if (!aliasParts) continue;
    if (aliasParts.length !== canonical.length) {
      extras.push(aliasParts.map((part) => [part]));
      continue;
    }
    for (let index = 0; index < aliasParts.length; index += 1) {
      const aliasPart = aliasParts[index] ?? "";
      const matchesAnotherPart = canonical.some(
        (part, partIndex) => partIndex !== index && closeEnough(aliasPart, part),
      );
      if (matchesAnotherPart) continue;
      const slot = slots[index];
      if (!slot || slot.includes(aliasPart)) continue;
      slot.push(aliasPart);
    }
  }

  return [slots, ...extras];
}

export function gradeResponse(
  question: GradableQuestion,
  response: string,
): boolean {
  if (question.type === "multiple_choice") {
    return response === question.answer;
  }

  const given = normalizeFillIn(response);
  if (!given) return false;

  const accepted = [question.answer, ...(question.aliases ?? [])];
  const expected = accepted
    .map((value) => normalizeFillIn(value))
    .filter((value) => value.length > 0);

  // Whole-string matches run first. A listed alias, or the answer itself,
  // is accepted before the response is split into parts.
  if (expected.some((candidate) => closeEnough(given, candidate))) return true;

  const givenParts = splitAnswerParts(response);
  if (!givenParts) return false;

  return acceptedPartSets(question.answer, question.aliases).some((slots) =>
    partsMatch(givenParts, slots),
  );
}
