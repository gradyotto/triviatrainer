const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "anonymous",
  "api",
  "account",
  "billing",
  "clerk",
  "daily",
  "guest",
  "help",
  "leaderboard",
  "mod",
  "moderator",
  "null",
  "official",
  "owner",
  "posthog",
  "root",
  "security",
  "signin",
  "signup",
  "staff",
  "stripe",
  "support",
  "system",
  "team",
  "trivia",
  "triviatrainer",
  "undefined",
  "user",
  "www",
]);

const PROFANITY = [
  "asshole",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "fuck",
  "nigger",
  "nigga",
  "piss",
  "shit",
  "slut",
  "whore",
];

export type UsernameIssue = "format" | "reserved" | "profanity";

export function usernameIssue(value: string): UsernameIssue | null {
  const trimmed = value.trim();
  if (!USERNAME.test(trimmed)) return "format";
  const lower = trimmed.toLowerCase();
  if (RESERVED.has(lower)) return "reserved";
  if (PROFANITY.some((word) => lower.includes(word))) return "profanity";
  return null;
}

export function usernameMessage(issue: UsernameIssue): string {
  if (issue === "format") {
    return "Use 3–20 characters: letters, numbers, and underscores.";
  }
  return "That username isn't available.";
}
