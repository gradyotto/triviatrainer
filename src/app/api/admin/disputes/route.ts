import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminClerkId } from "@/lib/admin";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { acceptDispute, rejectDispute } from "@/lib/disputes/resolve";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

export async function POST(request: Request) {
  const clerkId = await getSignedInClerkId();
  if (!isAdminClerkId(clerkId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dispute action" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "reject") {
      const ok = await rejectDispute(parsed.data.id);
      if (!ok) return NextResponse.json({ error: "Dispute not open" }, { status: 404 });
      return NextResponse.json({ ok: true, regraded: false });
    }
    const result = await acceptDispute(parsed.data.id);
    if (!result?.ok) {
      return NextResponse.json({ error: "Could not accept that dispute" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, regraded: result.regraded });
  } catch {
    console.error("Failed to resolve a dispute");
    return NextResponse.json({ error: "Could not update that dispute" }, { status: 503 });
  }
}
