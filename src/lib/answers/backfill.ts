import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { questions } from "@/db/schema";
import { mergeAccepted, planDeterministicAnswers } from "@/lib/answers/deterministic";
import { createAnswerProvider } from "@/lib/answers/provider";

export type AnswerBackfillResult = {
  provider: "openai" | "deterministic";
  examined: number;
  updated: number;
  skipped: number;
  withAliases: number;
  withBonus: number;
};

export async function backfillAcceptedAnswers(options?: {
  force?: boolean;
}): Promise<AnswerBackfillResult> {
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
      aliases: questions.answerAliases,
      bonusPrompt: questions.bonusPrompt,
      bonusAnswers: questions.bonusAnswers,
      answersGeneratedAt: questions.answersGeneratedAt,
    })
    .from(questions)
    .where(eq(questions.type, "fill_in"));

  const planned = new Map(
    planDeterministicAnswers(rows).map((item) => [item.id, item]),
  );
  const provider = createAnswerProvider();
  const result: AnswerBackfillResult = {
    provider: provider.name,
    examined: rows.length,
    updated: 0,
    skipped: 0,
    withAliases: 0,
    withBonus: 0,
  };

  for (const row of rows) {
    const plan = planned.get(row.id);
    if (!plan) continue;
    if (row.answersGeneratedAt && !force) {
      result.skipped += 1;
      continue;
    }

    let accepted = plan.accepted;
    let bonusPrompt = plan.bonusPrompt;
    let bonusAnswers = plan.bonusAnswers;
    if (provider.name === "openai") {
      const generated = await provider.generate({
        prompt: row.prompt,
        answer: row.answer,
      });
      if (generated.accepted.length > 0) accepted = generated.accepted;
      if (plan.bonusPrompt && generated.bonus) {
        bonusPrompt = generated.bonus.prompt;
        bonusAnswers = generated.bonus.answers;
      }
    }

    if (!force) {
      accepted = mergeAccepted(row.answer, [...(row.aliases ?? []), ...accepted]);
      if (row.bonusPrompt) {
        bonusPrompt = row.bonusPrompt;
        bonusAnswers = row.bonusAnswers ?? [];
      }
    } else {
      accepted = mergeAccepted(row.answer, accepted);
      bonusAnswers = mergeAccepted(row.answer, bonusAnswers);
    }

    await db
      .update(questions)
      .set({
        answerAliases: accepted,
        bonusPrompt,
        bonusAnswers,
        answersGeneratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(questions.id, row.id));

    result.updated += 1;
    if (accepted.length > 0) result.withAliases += 1;
    if (bonusPrompt && bonusAnswers.length > 0) result.withBonus += 1;
  }

  return result;
}
