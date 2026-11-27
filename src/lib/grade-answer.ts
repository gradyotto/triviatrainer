import { createAnswerProvider, type SemanticInput } from "@/lib/answers/provider";
import {
  gradeResponse,
  isBorderlineAnswer,
  type GradableQuestion,
} from "@/lib/grading";

export type SemanticChecker = {
  equivalent(input: SemanticInput): Promise<boolean>;
};

/**
 * Deterministic grading first. A semantic check runs only for a borderline
 * miss, and only when the swappable provider implements one (an AI key is set).
 */
export async function gradeWithSemantics(
  question: GradableQuestion & { prompt?: string },
  response: string,
  checker?: SemanticChecker | null,
): Promise<boolean> {
  if (gradeResponse(question, response)) return true;
  if (question.type !== "fill_in") return false;
  const accepted = [question.answer, ...(question.aliases ?? [])];
  if (!isBorderlineAnswer(response, accepted)) return false;
  const judge =
    checker === undefined ? checkerFromProvider() : checker;
  if (!judge) return false;
  try {
    return await judge.equivalent({
      prompt: question.prompt ?? "",
      answer: question.answer,
      aliases: question.aliases ?? [],
      response,
    });
  } catch {
    return false;
  }
}

function checkerFromProvider(): SemanticChecker | null {
  const provider = createAnswerProvider();
  if (!provider.judgeEquivalent) return null;
  const judge = provider.judgeEquivalent.bind(provider);
  return { equivalent: judge };
}
