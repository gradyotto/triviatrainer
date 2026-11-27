export type ArtworkImage = {
  url: string;
  alt: string;
  credit: string;
};

const VISUAL_ART =
  /\b(painting|triptych|sculpture|fresco|mural|portrait|artwork|painted)\b/i;

const ASKS_IDENTITY =
  /\b(who|whom|artist|painter|sculptor|country|city|born|created by|painted by|from which|which country|which city)\b/i;

const ASKS_TITLE =
  /titled\s+_{2,}|titled\s+\?|\b(?:called|named)\s+_{2,}|title of the (?:painting|triptych|work|artwork|sculpture)/i;

export function isVisualArtPrompt(prompt: string): boolean {
  return VISUAL_ART.test(prompt);
}

/**
 * Name-the-artwork questions hide the image until the answer is in.
 * A painting shown while asking for the city or the artist does not reveal
 * that answer, so it can appear with the question.
 */
export function artworkTiming(prompt: string, answer: string): "before" | "after" {
  if (ASKS_TITLE.test(prompt)) return "after";
  const art = isVisualArtPrompt(prompt);
  const blank = /_{2,}/.test(prompt);
  if (art && blank && !ASKS_IDENTITY.test(prompt)) return "after";
  if (art && blank && looksLikeTitle(answer) && !ASKS_IDENTITY.test(prompt)) {
    return "after";
  }
  return "before";
}

function looksLikeTitle(answer: string): boolean {
  const words = answer.trim().split(/\s+/).filter((word) => word.length > 0);
  return words.length >= 2;
}

export function quotedTitles(prompt: string): string[] {
  const titles: string[] = [];
  for (const match of prompt.matchAll(/['"“”]([^'"“”]{3,80})['"“”]/g)) {
    const title = match[1]?.trim();
    if (title) titles.push(title);
  }
  return titles;
}

/** Commons search string for a question about a specific work, or null. */
export function artworkSearchTitle(prompt: string, answer: string): string | null {
  if (!isVisualArtPrompt(prompt)) return null;
  if (artworkTiming(prompt, answer) === "after") {
    const title = answer.trim();
    if (title.length >= 3) return title;
  }
  return quotedTitles(prompt)[0] ?? null;
}

export function toArtworkImage(input: {
  url: string | null | undefined;
  alt: string | null | undefined;
  credit: string | null | undefined;
  prompt: string;
  answer: string;
}): { image: ArtworkImage; timing: "before" | "after" } | null {
  if (!input.url) return null;
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return null;
  }
  const allowedHost =
    parsed.hostname === "upload.wikimedia.org" ||
    parsed.hostname === "thumb.wikimedia.org";
  if (parsed.protocol !== "https:" || !allowedHost) {
    return null;
  }
  const alt = input.alt?.trim() || artworkSearchTitle(input.prompt, input.answer) || "Artwork";
  const credit = input.credit?.trim() || "Wikimedia Commons";
  return {
    timing: artworkTiming(input.prompt, input.answer),
    image: { url: input.url, alt, credit },
  };
}

/** Image safe to send before the player answers. */
export function imageBeforeAnswer(input: {
  url: string | null | undefined;
  alt: string | null | undefined;
  credit: string | null | undefined;
  prompt: string;
  answer: string;
}): ArtworkImage | null {
  const artwork = toArtworkImage(input);
  if (!artwork || artwork.timing !== "before") return null;
  return artwork.image;
}
