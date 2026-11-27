import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

function safeMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return "Accepted-answer backfill failed.";
  }
  if (error.message.includes("://") || error.message.includes("@")) {
    return "Accepted-answer backfill failed while connecting to the database.";
  }
  return error.message;
}

async function main() {
  const { backfillAcceptedAnswers } = await import("@/lib/answers/backfill");
  const force = process.argv.includes("--force");
  const result = await backfillAcceptedAnswers({ force });
  const bonusRate =
    result.examined > 0
      ? `${Math.round((result.withBonus / result.examined) * 100)}%`
      : "0%";
  console.log(
    `Accepted-answer backfill (${result.provider}${force ? ", force" : ""}): examined ${result.examined}, updated ${result.updated}, skipped ${result.skipped}, with aliases ${result.withAliases}, with bonus ${result.withBonus} (${bonusRate}), dropped bonuses ${result.droppedBonuses}.`,
  );
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
