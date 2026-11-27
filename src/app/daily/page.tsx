import type { Metadata } from "next";
import { DailyChallenge } from "@/components/daily/daily-challenge";
import { dailyActor } from "@/lib/daily/http";
import { getDailyState } from "@/lib/daily/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Challenge",
};

export default async function DailyPage() {
  const actor = await dailyActor();
  const state = await getDailyState(actor);
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <DailyChallenge initial={state} />
    </main>
  );
}
