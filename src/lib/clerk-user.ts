import { auth } from "@clerk/nextjs/server";
import { isClerkConfigured } from "@/lib/env";

function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function getSignedInClerkId(): Promise<string | null> {
  if (!isClerkConfigured()) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    return null;
  }
}
