import { and, count, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { categories, questions } from "@/db/schema";
import { deterministicDraft, mergeAccepted } from "@/lib/answers/deterministic";
import { imageBeforeAnswer, toArtworkImage, type ArtworkImage } from "@/lib/artwork/reveal";
import { gradeWithSemantics } from "@/lib/grade-answer";
import { getSeedBank, seedQuestionId } from "@/lib/seed-bank";
import type { CategorySummary, PublicQuestion, QuestionType } from "@/lib/train-types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UnknownCategoryError extends Error {
  constructor(slug: string) {
    super(`Unknown category: ${slug}`);
    this.name = "UnknownCategoryError";
  }
}

type GradableRecord = {
  databaseId: string | null;
  type: QuestionType;
  prompt: string;
  answer: string;
  aliases: string[];
  explanation: string | null;
  image: ArtworkImage | null;
};

export type QuestionSource = "database" | "seed";

function asCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swap] as T;
    copy[swap] = current as T;
  }
  return copy;
}

function seedCategories(): CategorySummary[] {
  const bank = getSeedBank();
  return bank.categories
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      questionCount: bank.questions.filter(
        (question) => question.category === category.slug,
      ).length,
    }))
    .filter((category) => category.questionCount > 0);
}

async function databaseCategories(): Promise<CategorySummary[] | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const db = getDb();
    const rows = await db
      .select({
        slug: categories.slug,
        name: categories.name,
        sortOrder: categories.sortOrder,
        questionCount: count(questions.id),
      })
      .from(categories)
      .leftJoin(
        questions,
        and(
          eq(questions.categoryId, categories.id),
          eq(questions.isActive, true),
        ),
      )
      .groupBy(
        categories.id,
        categories.slug,
        categories.name,
        categories.sortOrder,
      )
      .orderBy(categories.sortOrder);

    const summaries = rows
      .map((row) => ({
        slug: row.slug,
        name: row.name,
        questionCount: asCount(row.questionCount),
      }))
      .filter((row) => row.questionCount > 0);

    return summaries.length > 0 ? summaries : null;
  } catch {
    console.error("Category query failed; using the seed bank.");
    return null;
  }
}

export async function listCategories(): Promise<{
  source: QuestionSource;
  categories: CategorySummary[];
}> {
  const fromDatabase = await databaseCategories();
  if (fromDatabase) {
    return { source: "database", categories: fromDatabase };
  }
  return { source: "seed", categories: seedCategories() };
}

type InternalQuestion = PublicQuestion & {
  answer: string;
  aliases: string[];
  explanation: string | null;
  databaseId: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCredit: string | null;
};

async function loadDatabaseQuestions(): Promise<InternalQuestion[] | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: questions.id,
        type: questions.type,
        prompt: questions.prompt,
        answer: questions.answer,
        aliases: questions.answerAliases,
        options: questions.options,
        difficulty: questions.difficulty,
        hint: questions.hint,
        explanation: questions.explanation,
        imageUrl: questions.imageUrl,
        imageAlt: questions.imageAlt,
        imageCredit: questions.imageCredit,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(questions)
      .innerJoin(categories, eq(questions.categoryId, categories.id))
      .where(eq(questions.isActive, true));

    if (rows.length === 0) return null;
    return rows.map((row) => ({
      id: row.id,
      databaseId: row.id,
      type: row.type,
      prompt: row.prompt,
      answer: row.answer,
      aliases: row.aliases ?? [],
      options: row.options,
      explanation: row.explanation,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
      imageCredit: row.imageCredit,
      categorySlug: row.categorySlug,
      categoryName: row.categoryName,
      difficulty: row.difficulty,
      hint: row.hint,
      image: null,
    }));
  } catch {
    console.error("Question query failed; using the seed bank.");
    return null;
  }
}

function seedAliases(question: {
  type: string;
  prompt: string;
  answer: string;
  aliases: string[];
}): string[] {
  if (question.type !== "fill_in") return [...question.aliases];
  return mergeAccepted(question.answer, [
    ...question.aliases,
    ...deterministicDraft(question).accepted,
  ]);
}

function loadSeedQuestions(): InternalQuestion[] {
  return getSeedBank().questions.map((question) => {
    const category = getSeedBank().categories.find(
      (item) => item.slug === question.category,
    );
    return {
      id: seedQuestionId(question.legacyId),
      databaseId: null,
      type: question.type,
      prompt: question.prompt,
      answer: question.answer,
      aliases: seedAliases(question),
      options: question.options,
      explanation: question.explanation,
      imageUrl: null,
      imageAlt: null,
      imageCredit: null,
      categorySlug: question.category,
      categoryName: category?.name ?? question.category,
      difficulty: question.difficulty,
      hint: question.hint,
      image: null,
    };
  });
}

export function toPublicQuestion(question: {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  categorySlug: string;
  categoryName: string;
  difficulty: string;
  hint: string | null;
  answer?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageCredit?: string | null;
}): PublicQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options:
      question.type === "multiple_choice" && question.options
        ? shuffle(question.options)
        : null,
    categorySlug: question.categorySlug,
    categoryName: question.categoryName,
    difficulty: question.difficulty,
    hint: question.hint,
    image: imageBeforeAnswer({
      url: question.imageUrl,
      alt: question.imageAlt,
      credit: question.imageCredit,
      prompt: question.prompt,
      answer: question.answer ?? "",
    }),
  };
}

function toPublic(question: InternalQuestion): PublicQuestion {
  return toPublicQuestion({
    ...question,
    imageUrl: question.imageUrl,
    imageAlt: question.imageAlt,
    imageCredit: question.imageCredit,
  });
}

export async function drawQuestions(
  category: string,
  limit: number,
): Promise<{ source: QuestionSource; questions: PublicQuestion[] }> {
  const databaseQuestions = await loadDatabaseQuestions();
  const source: QuestionSource = databaseQuestions ? "database" : "seed";
  const pool = databaseQuestions ?? loadSeedQuestions();
  const filtered =
    category === "mixed"
      ? pool
      : pool.filter((question) => question.categorySlug === category);

  if (category !== "mixed" && filtered.length === 0) {
    throw new UnknownCategoryError(category);
  }

  return {
    source,
    questions: shuffle(filtered).slice(0, limit).map(toPublic),
  };
}

export async function findGradable(
  id: string,
): Promise<GradableRecord | null> {
  if (isDatabaseConfigured() && UUID_RE.test(id)) {
    try {
      const db = getDb();
      const rows = await db
        .select({
          id: questions.id,
          type: questions.type,
          answer: questions.answer,
          aliases: questions.answerAliases,
          prompt: questions.prompt,
          explanation: questions.explanation,
          imageUrl: questions.imageUrl,
          imageAlt: questions.imageAlt,
          imageCredit: questions.imageCredit,
        })
        .from(questions)
        .where(and(eq(questions.id, id), eq(questions.isActive, true)))
        .limit(1);
      const row = rows[0];
      if (row) {
        return {
          databaseId: row.id,
          type: row.type,
          prompt: row.prompt,
          answer: row.answer,
          aliases: row.aliases ?? [],
          explanation: row.explanation,
          image: toArtworkImage({
            url: row.imageUrl,
            alt: row.imageAlt,
            credit: row.imageCredit,
            prompt: row.prompt,
            answer: row.answer,
          })?.image ?? null,
        };
      }
    } catch {
      console.error("Question lookup failed; trying the seed bank.");
    }
  }

  if (!id.startsWith("seed:")) return null;
  const legacyId = Number(id.slice("seed:".length));
  if (!Number.isInteger(legacyId)) return null;
  const question = getSeedBank().questions.find(
    (item) => item.legacyId === legacyId,
  );
  if (!question) return null;
  return {
    databaseId: null,
    type: question.type,
    prompt: question.prompt,
    answer: question.answer,
    aliases: seedAliases(question),
    explanation: question.explanation,
    image: null,
  };
}

export async function gradeStoredQuestion(
  question: GradableRecord,
  response: string,
): Promise<boolean> {
  return gradeWithSemantics(
    {
      type: question.type,
      answer: question.answer,
      aliases: question.aliases,
      prompt: question.prompt,
    },
    response,
  );
}
