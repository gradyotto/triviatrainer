import { readEnv } from "@/lib/env";

export function isAdminClerkId(clerkId: string | null | undefined): boolean {
  if (!clerkId) return false;
  const raw = readEnv("ADMIN_CLERK_USER_IDS");
  if (!raw) return false;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .includes(clerkId);
}
