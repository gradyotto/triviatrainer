export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(readEnv("DATABASE_URL"));
}

export function clerkKeysAreUsable(
  publishableKey: string | undefined,
  secretKey: string | undefined,
): boolean {
  return Boolean(
    publishableKey &&
      secretKey &&
      /^pk_(test|live)_/.test(publishableKey) &&
      /^sk_(test|live)_/.test(secretKey),
  );
}

export function isClerkConfigured(): boolean {
  return clerkKeysAreUsable(
    readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    readEnv("CLERK_SECRET_KEY"),
  );
}
