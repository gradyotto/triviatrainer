import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

const pooledUrl = process.env.DATABASE_URL?.trim();
const directUrl = process.env.DATABASE_URL_UNPOOLED?.trim();
// The Neon pooler rejects session-level DDL. Migrations use the direct URL.
const databaseUrl = directUrl || pooledUrl || "";

if (!databaseUrl) {
  console.warn(
    "DATABASE_URL is not set. Drizzle commands need Neon credentials.",
  );
} else if (!directUrl && pooledUrl?.includes("-pooler")) {
  console.warn(
    "DATABASE_URL points at a Neon pooler. Set DATABASE_URL_UNPOOLED to the direct connection before migrating.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
