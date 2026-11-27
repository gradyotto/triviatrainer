import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db";
import { users } from "@/db/schema";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { setPostHogPerson } from "@/lib/tracking/posthog";
import { ensureUser } from "@/lib/users";
import { usernameIssue, usernameMessage } from "@/lib/username";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  username: z.string().max(40),
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "A database connection is required" },
      { status: 503 },
    );
  }
  const clerkId = await getSignedInClerkId();
  if (!clerkId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  const username = parsed.data.username.trim();
  const issue = usernameIssue(username);
  if (issue) {
    return NextResponse.json({ error: usernameMessage(issue) }, { status: 400 });
  }

  try {
    const user = await ensureUser(clerkId);
    const db = getDb();
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    if (taken[0] && taken[0].id !== user.id) {
      return NextResponse.json(
        { error: "That username is taken." },
        { status: 409 },
      );
    }
    await db
      .update(users)
      .set({ username, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await setPostHogPerson(clerkId, { username, plan: user.plan });
    return NextResponse.json({ username });
  } catch {
    console.error("Failed to save a username");
    return NextResponse.json(
      { error: "Could not save that username" },
      { status: 503 },
    );
  }
}
