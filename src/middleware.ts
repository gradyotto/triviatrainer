import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkKeysAreUsable, readEnv } from "@/lib/env";

let warnedAboutClerkKeys = false;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const publishableKey = readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const secretKey = readEnv("CLERK_SECRET_KEY");
  if (
    !publishableKey ||
    !secretKey ||
    !clerkKeysAreUsable(publishableKey, secretKey)
  ) {
    if (!warnedAboutClerkKeys && (publishableKey || secretKey)) {
      warnedAboutClerkKeys = true;
      console.error(
        "Clerk environment variables are set, but they are not usable pk_/sk_ keys. Continuing without auth.",
      );
    }
    return NextResponse.next();
  }

  return clerkMiddleware({
    publishableKey,
    secretKey,
  })(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
