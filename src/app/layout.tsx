import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { isClerkConfigured, readEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "TriviaTrainer",
    template: "%s · TriviaTrainer",
  },
  description:
    "Mobile-first trivia training for bar trivia and Jeopardy-minded players.",
};

function AuthControls() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm">Sign up</Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}

function Shell({
  showAuth,
  children,
}: {
  showAuth: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          TriviaTrainer
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/train"
            className="px-2 text-sm font-medium text-muted-foreground"
          >
            Train
          </Link>
          {showAuth ? (
            <Suspense
              fallback={
                <span className="text-sm text-muted-foreground">…</span>
              }
            >
              <AuthControls />
            </Suspense>
          ) : null}
        </nav>
      </header>
      {children}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = readEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const clerkEnabled = isClerkConfigured();
  const shell = <Shell showAuth={clerkEnabled}>{children}</Shell>;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {clerkEnabled && publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            appearance={{ theme: shadcn }}
          >
            {shell}
          </ClerkProvider>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
