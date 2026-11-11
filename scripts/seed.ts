import { config } from "dotenv";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

function safeMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return "Seed failed.";
  if (error.message.includes("://") || error.message.includes("@")) {
    return "Seed failed while connecting to the database.";
  }
  return error.message;
}

async function main() {
  const { getDb, isDatabaseConfigured } = await import("@/db");
  const { categories, questions } = await import("@/db/schema");
  const { getSeedBank } = await import("@/lib/seed-bank");

  if (!isDatabaseConfigured()) {
    console.error(
      "DATABASE_URL is not set. Training still works from data/seed-questions.json. Set DATABASE_URL to load the bank into Postgres.",
    );
    process.exit(1);
  }

  const bank = getSeedBank();
  const db = getDb();
  const now = new Date();

  await db
    .insert(categories)
    .values(
      bank.categories.map((category) => ({
        slug: category.slug,
        name: category.name,
        sortOrder: category.sortOrder,
        isPremium: false,
      })),
    )
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: sql`excluded.name`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  const storedCategories = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories);
  const categoryIdBySlug = new Map(
    storedCategories.map((category) => [category.slug, category.id]),
  );

  const rows = bank.questions.map((question) => {
    const categoryId = categoryIdBySlug.get(question.category);
    if (!categoryId) {
      throw new Error(`Missing category row for ${question.category}.`);
    }
    return {
      categoryId,
      type: question.type,
      prompt: question.prompt,
      answer: question.answer,
      answerAliases: question.aliases,
      options: question.options,
      difficulty: question.difficulty,
      hint: question.hint,
      explanation: question.explanation,
      tags: question.tags,
      source: question.source,
      legacyId: question.legacyId,
      isActive: true,
      updatedAt: now,
    };
  });

  await db
    .insert(questions)
    .values(rows)
    .onConflictDoUpdate({
      target: questions.legacyId,
      set: {
        categoryId: sql`excluded.category_id`,
        type: sql`excluded.type`,
        prompt: sql`excluded.prompt`,
        answer: sql`excluded.answer`,
        answerAliases: sql`excluded.answer_aliases`,
        options: sql`excluded.options`,
        difficulty: sql`excluded.difficulty`,
        hint: sql`excluded.hint`,
        explanation: sql`excluded.explanation`,
        tags: sql`excluded.tags`,
        source: sql`excluded.source`,
        isActive: sql`excluded.is_active`,
        updatedAt: sql`now()`,
      },
    });

  console.log(
    `Seeded ${bank.categories.length} categories and ${bank.questions.length} questions.`,
  );
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
