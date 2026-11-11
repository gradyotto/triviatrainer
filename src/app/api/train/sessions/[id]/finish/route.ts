import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { finishTrainingSession } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  durationSeconds: z.number().finite().nonnegative(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session finish" }, { status: 400 });
  }

  const clerkUserId = await getSignedInClerkId();
  if (!clerkUserId) {
    return NextResponse.json({ persisted: false });
  }

  try {
    const persisted = await finishTrainingSession({
      clerkUserId,
      sessionId: id,
      durationSeconds: parsed.data.durationSeconds,
    });
    return NextResponse.json({ persisted });
  } catch {
    console.error("Failed to finish a training session");
    return NextResponse.json({ persisted: false });
  }
}
