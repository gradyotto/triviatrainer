/**
 * Conservative whole-answer equivalents. Grading expands these after
 * normalization, so "U.S." and "USA" meet "United States" without a stored alias.
 * Groups stay small on purpose: a near miss that is not listed is not accepted
 * unless the optional semantic checker is enabled.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["psychiatric", "mental"],
  ["United States", "United States of America", "USA", "U.S."],
  ["United Kingdom", "UK", "U.K.", "Britain", "Great Britain"],
  ["Soviet Union", "USSR"],
  ["New York City", "NYC"],
];

export function synonymForms(
  normalized: string,
  normalize: (value: string) => string,
): string[] {
  for (const group of SYNONYM_GROUPS) {
    const forms = group.map((item) => normalize(item));
    if (forms.includes(normalized)) return forms;
  }
  return [];
}

/** Surface forms to store as aliases, excluding the canonical answer. */
export function synonymAliases(
  answer: string,
  normalize: (value: string) => string,
): string[] {
  const key = normalize(answer);
  for (const group of SYNONYM_GROUPS) {
    if (!group.some((item) => normalize(item) === key)) continue;
    return group.filter((item) => normalize(item) !== key);
  }
  return [];
}
