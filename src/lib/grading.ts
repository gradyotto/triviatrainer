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

export function gradeResponse(
  question: GradableQuestion,
  response: string,
): boolean {
  if (question.type === "multiple_choice") {
    return response === question.answer;
  }

  const given = normalizeFillIn(response);
  if (!given) return false;

  const expected = [question.answer, ...(question.aliases ?? [])]
    .map((value) => normalizeFillIn(value))
    .filter((value) => value.length > 0);

  return expected.some((candidate) => closeEnough(given, candidate));
}
