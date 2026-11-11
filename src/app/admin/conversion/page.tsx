import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlanConfig } from "@/config/plans";
import { isAdminClerkId } from "@/lib/admin";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { getConversionSummary } from "@/lib/tracking/summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Conversion",
};

function percent(rate: number | null): string {
  if (rate == null) return "–";
  return `${Math.round(rate * 1000) / 10}%`;
}

export default async function ConversionAdminPage() {
  const clerkUserId = await getSignedInClerkId();
  if (!isAdminClerkId(clerkUserId)) notFound();

  const summary = await getConversionSummary();
  const config = getPlanConfig();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Conversion</h1>
        <p className="text-sm text-muted-foreground">
          Config {config.version}: free users get {config.free.questionsPerDay}{" "}
          questions a day and {config.free.aiCurrentEventsPerDay} AI
          current-events questions a day. Signup is the first sign-in. The
          rate is people who later upgraded, divided by signups in that cohort.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Free to Pro</h2>
        {summary.cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signups recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Version</th>
                  <th className="px-3 py-2 font-medium">Free limits</th>
                  <th className="px-3 py-2 font-medium">Signups</th>
                  <th className="px-3 py-2 font-medium">Upgrades</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.cohorts.map((cohort) => (
                  <tr
                    key={`${cohort.version}-${cohort.limits?.freeQuestionsPerDay}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2">{cohort.version}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {cohort.limits
                        ? `${cohort.limits.freeQuestionsPerDay} q / ${cohort.limits.freeAiCurrentEventsPerDay} AI`
                        : "–"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{cohort.signups}</td>
                    <td className="px-3 py-2 tabular-nums">{cohort.upgrades}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {percent(cohort.conversionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Events</h2>
        {summary.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Version</th>
                  <th className="px-3 py-2 font-medium">Count</th>
                  <th className="px-3 py-2 font-medium">People</th>
                </tr>
              </thead>
              <tbody>
                {summary.events.map((event) => (
                  <tr
                    key={`${event.event}-${event.version}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2">{event.event}</td>
                    <td className="px-3 py-2">{event.version}</td>
                    <td className="px-3 py-2 tabular-nums">{event.total}</td>
                    <td className="px-3 py-2 tabular-nums">{event.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
