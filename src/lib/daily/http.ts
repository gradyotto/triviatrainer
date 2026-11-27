import { cookies } from "next/headers";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isDatabaseConfigured } from "@/lib/env";
import { ensureUser, getUserByClerkId, type UserRecord } from "@/lib/users";
import { GUEST_COOKIE, newGuestId, parseGuestId } from "./guest";
import { claimGuestAttempts } from "./service";

export async function readGuestId(): Promise<string | null> {
  const jar = await cookies();
  return parseGuestId(jar.get(GUEST_COOKIE)?.value);
}

export async function ensureGuestId(): Promise<string> {
  const existing = await readGuestId();
  if (existing) return existing;
  const id = newGuestId();
  const jar = await cookies();
  jar.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}

export async function dailyActor(options?: {
  createGuest?: boolean;
}): Promise<{ user: UserRecord | null; guestId: string | null }> {
  const clerkId = await getSignedInClerkId();
  const guestId =
    options?.createGuest && !clerkId ? await ensureGuestId() : await readGuestId();
  if (!clerkId || !isDatabaseConfigured()) {
    return { user: null, guestId };
  }
  let user = await ensureUser(clerkId);
  if (guestId) {
    await claimGuestAttempts(user.id, guestId, clerkId);
    user = (await getUserByClerkId(clerkId)) ?? user;
  }
  return { user, guestId };
}
