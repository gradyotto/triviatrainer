import { cookies } from "next/headers";
import { TimezoneSync } from "@/components/account/timezone-sync";
import { PostHogIdentity } from "@/components/analytics/posthog";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { GUEST_COOKIE, parseGuestId } from "@/lib/daily/guest";
import { claimGuestAttempts } from "@/lib/daily/service";
import { isDatabaseConfigured } from "@/lib/env";
import { ensureUser, getUserByClerkId } from "@/lib/users";

export async function SignedInSync() {
  const clerkId = await getSignedInClerkId();
  let username: string | null = null;
  let plan: string | null = null;
  if (clerkId && isDatabaseConfigured()) {
    try {
      const user = await ensureUser(clerkId);
      username = user.username;
      plan = user.plan;
      const jar = await cookies();
      const guestId = parseGuestId(jar.get(GUEST_COOKIE)?.value);
      if (guestId) {
        await claimGuestAttempts(user.id, guestId, clerkId);
        const refreshed = await getUserByClerkId(clerkId);
        username = refreshed?.username ?? username;
        plan = refreshed?.plan ?? plan;
      }
    } catch {
      console.error("Failed to sync the signed-in user");
    }
  }
  return (
    <>
      {clerkId ? <TimezoneSync /> : null}
      <PostHogIdentity clerkId={clerkId} username={username} plan={plan} />
    </>
  );
}
