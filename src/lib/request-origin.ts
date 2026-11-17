import { readEnv } from "@/lib/env";

export function requestOrigin(request: Request): string {
  const configured = readEnv("NEXT_PUBLIC_APP_URL") ?? readEnv("APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host =
    forwardedHost?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
