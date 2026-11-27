import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { questions } from "@/db/schema";
import {
  isKeptBonus,
  mergeAccepted,
  planDeterministicAnswers,
} from "@/lib/answers/deterministic";
import { createAnswerProvider } from "@/lib/answers/provider";
import { normalizeFillIn } from "@/lib/grading";
import { synonymAliases } from "@/lib/synonyms";

export type AnswerBackfillResult = {
  provider: "openai" | "deterministic";
  examined: number;
  updated: number;
  skipped: number;
  withAliases: number;
  withBonus: number;
  droppedBonuses: number;
};

function sameList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

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
    })
    .from(questions)
    .where(eq(questions.type, "fill_in"));

  const planned = new Map(
    planDeterministicAnswers(rows).map((item) => [item.id, item]),
  );
  const provider = createAnswerProvider();
  const useModel = force && provider.name === "openai";
  const result: AnswerBackfillResult = {
    provider: useModel ? "openai" : "deterministic",
    examined: rows.length,
    updated: 0,
    skipped: 0,
    withAliases: 0,
    withBonus: 0,
    droppedBonuses: 0,
  };

  for (const row of rows) {
    const plan = planned.get(row.id);
    if (!plan) continue;
    let bonusPrompt = plan.bonusPrompt;
    let bonusAnswers = plan.bonusAnswers;
    let generatedAccepted: string[] = [];
    if (useModel) {
      const generated = await provider.generate({
        prompt: row.prompt,
        answer: row.answer,
      });
      generatedAccepted = generated.accepted;
      if (
        generated.bonus &&
        isKeptBonus({
          prompt: generated.bonus.prompt,
          answers: generated.bonus.answers,
          canonicalAnswer: row.answer,
        })
      ) {
        bonusPrompt = generated.bonus.prompt;
        bonusAnswers = mergeAccepted(row.answer, generated.bonus.answers);
      }
    }

    const accepted = mergeAccepted(row.answer, [
      ...(row.aliases ?? []),
      ...plan.accepted,
      ...synonymAliases(row.answer, normalizeFillIn),
      ...generatedAccepted,
    ]);
    const hadBonus = Boolean(row.bonusPrompt);
    const hasBonus = Boolean(bonusPrompt && bonusAnswers.length > 0);
    if (hadBonus && !hasBonus) result.droppedBonuses += 1;
    if (accepted.length > 0) result.withAliases += 1;
    if (hasBonus) result.withBonus += 1;

    const unchanged =
      sameList(row.aliases ?? [], accepted) &&
      (row.bonusPrompt ?? null) === (bonusPrompt ?? null) &&
      sameList(row.bonusAnswers ?? [], bonusAnswers);
    if (unchanged) {
      result.skipped += 1;
      continue;
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
  }

  return result;
}
