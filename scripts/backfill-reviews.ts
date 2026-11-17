import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

function safeMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return "Review backfill failed.";
  if (error.message.includes("://") || error.message.includes("@")) {
    return "Review backfill failed while connecting to the database.";
  }
  return error.message;
}

async function main() {
  const { backfillReviewSchedules } = await import("@/lib/review/backfill");
  const force = process.argv.includes("--force");
  const result = await backfillReviewSchedules({ force });
  console.log(
    `Review backfill${force ? " (force)" : ""}: updated ${result.updated}, inserted ${result.inserted}, skipped ${result.skipped}.`,
  );
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
