import { TimezoneSync } from "@/components/account/timezone-sync";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { ensureUser } from "@/lib/users";

export async function SignedInSync() {
  const clerkId = await getSignedInClerkId();
  if (!clerkId) return null;
  if (isDatabaseConfigured()) {
    try {
      await ensureUser(clerkId);
    } catch {
      console.error("Failed to sync the signed-in user");
    }
  }
  return <TimezoneSync />;
}
