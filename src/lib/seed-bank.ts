import { z } from "zod";
import rawBank from "../../data/seed-questions.json";

const questionSchema = z
  .object({
    legacyId: z.number().int().positive(),
    category: z.string().min(1),
    type: z.enum(["multiple_choice", "fill_in"]),
    prompt: z.string().min(1),
    answer: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    options: z.array(z.string().min(1)).nullable(),
    difficulty: z.string().min(1),
    hint: z.string().nullable(),
    explanation: z.string().nullable(),
    tags: z.array(z.string()),
    source: z.string().nullable(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "multiple_choice") {
      if (!question.options || question.options.length < 2) {
        ctx.addIssue("Multiple choice questions need at least two options");
      } else if (!question.options.includes(question.answer)) {
        ctx.addIssue("Multiple choice answer must match one option exactly");
      }
    }
    if (question.type === "fill_in" && question.options !== null) {
      ctx.addIssue("Fill-in questions should not include options");
    }
  });

const seedFileSchema = z.object({
  categories: z
    .array(
      z.object({
        slug: z.string().min(1),
        name: z.string().min(1),
        sortOrder: z.number().int(),
      }),
    )
    .min(1),
  questions: z.array(questionSchema).min(1),
});

export type SeedQuestion = z.infer<typeof questionSchema>;
export type SeedCategory = z.infer<typeof seedFileSchema>["categories"][number];
export type SeedBank = z.infer<typeof seedFileSchema>;

let cached: SeedBank | null = null;

export function getSeedBank(): SeedBank {
  if (cached) return cached;
  const parsed = seedFileSchema.parse(rawBank);
  const slugs = new Set(parsed.categories.map((category) => category.slug));
  const ids = new Set<number>();
  for (const question of parsed.questions) {
    if (!slugs.has(question.category)) {
      throw new Error(
        `Seed question ${question.legacyId} uses unknown category ${question.category}`,
      );
    }
    if (ids.has(question.legacyId)) {
      throw new Error(`Duplicate seed legacy id ${question.legacyId}`);
    }
    ids.add(question.legacyId);
  }
  cached = parsed;
  return parsed;
}

export function seedQuestionId(legacyId: number): string {
  return `seed:${legacyId}`;
}
