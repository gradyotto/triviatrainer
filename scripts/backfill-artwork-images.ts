import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

function safeMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return "Artwork-image backfill failed.";
  }
  if (error.message.includes("://") || error.message.includes("@")) {
    return "Artwork-image backfill failed while connecting to the database.";
  }
  return error.message;
}

async function main() {
  const { backfillArtworkImages } = await import("@/lib/artwork/backfill");
  const force = process.argv.includes("--force");
  const result = await backfillArtworkImages({ force });
  console.log(
    `Artwork-image backfill${force ? " (force)" : ""}: examined ${result.examined}, titled ${result.titled}, updated ${result.updated}, already set ${result.alreadySet}, unmatched ${result.unmatched}.`,
  );
}

main().catch((error: unknown) => {
  console.error(safeMessage(error));
  process.exit(1);
});
