import { randomBytes } from "node:crypto";

export const GUEST_COOKIE = "tt_guest";

const GUEST_ID = /^[a-f0-9]{32}$/;

export function parseGuestId(value: string | undefined | null): string | null {
  if (!value || !GUEST_ID.test(value)) return null;
  return value;
}

export function newGuestId(): string {
  return randomBytes(16).toString("hex");
}
