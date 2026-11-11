import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isDatabaseConfigured, readEnv } from "@/lib/env";
import * as schema from "./schema";

export { isDatabaseConfigured };

export function getDb() {
  const url = readEnv("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof getDb>;
