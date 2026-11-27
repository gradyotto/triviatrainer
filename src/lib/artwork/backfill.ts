import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { categories, questions } from "@/db/schema";
import { searchCommonsArtwork } from "@/lib/artwork/commons";
import { artworkSearchTitle } from "@/lib/artwork/reveal";

function searchQuery(prompt: string, answer: string): string | null {
  const title = artworkSearchTitle(prompt, answer);
  if (!title) return null;
  const qualifier = /sculpt/i.test(prompt) ? "sculpture" : "painting";
  return `${title} ${qualifier}`;
}

export type ArtworkBackfillResult = {
  examined: number;
  titled: number;
  updated: number;
  alreadySet: number;
  unmatched: number;
};

export async function backfillArtworkImages(options?: {
  force?: boolean;
}): Promise<ArtworkBackfillResult> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not set.");
  }
  const force = options?.force === true;
  const db = getDb();
  const rows = await db
    .select({
      id: questions.id,
      prompt: questions.prompt,
      answer: questions.answer,
      imageUrl: questions.imageUrl,
      explanation: questions.explanation,
    })
    .from(questions)
    .innerJoin(categories, eq(questions.categoryId, categories.id))
    .where(eq(questions.isActive, true));

  const result: ArtworkBackfillResult = {
    examined: rows.length,
    titled: 0,
    updated: 0,
    alreadySet: 0,
    unmatched: 0,
  };

  for (const row of rows) {
    const title = searchQuery(row.prompt, row.answer);
    if (!title) continue;
    result.titled += 1;
    if (row.imageUrl && !force) {
      result.alreadySet += 1;
      continue;
    }
    const hints = (row.explanation ?? "").match(/\b[A-Z][a-z]{2,}\b/g) ?? [];
    const image = await searchCommonsArtwork(title, hints);
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!image) {
      result.unmatched += 1;
      continue;
    }
    await db
      .update(questions)
      .set({
        imageUrl: image.url,
        imageAlt: artworkSearchTitle(row.prompt, row.answer) ?? image.alt,
        imageCredit: image.credit,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, row.id));
    result.updated += 1;
  }

  return result;
}
