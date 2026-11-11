import { NextResponse } from "next/server";
import { listCategories } from "@/lib/questions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await listCategories();
  return NextResponse.json(result);
}
