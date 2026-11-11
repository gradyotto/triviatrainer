import { NextResponse } from "next/server";
import { drawQuestions, UnknownCategoryError } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? "mixed";
  if (category !== "mixed" && !/^[a-z0-9-]{1,64}$/.test(category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  const requested = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requested)
    ? Math.min(20, Math.max(1, Math.floor(requested)))
    : DEFAULT_LIMIT;

  try {
    const result = await drawQuestions(category, limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnknownCategoryError) {
      return NextResponse.json({ error: "Unknown category" }, { status: 404 });
    }
    console.error("Failed to draw questions");
    return NextResponse.json(
      { error: "Could not load questions" },
      { status: 500 },
    );
  }
}
