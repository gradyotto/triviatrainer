import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { DisputeActions } from "@/app/admin/disputes/dispute-actions";
import { isAdminClerkId } from "@/lib/admin";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { listOpenDisputes } from "@/lib/disputes/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Disputes",
};

function formatWhen(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Phoenix",
  }).format(value);
}

export default async function DisputesAdminPage() {
  const clerkUserId = await getSignedInClerkId();
  if (!isAdminClerkId(clerkUserId)) notFound();

  const disputes = await listOpenDisputes();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-3">
        <AdminNav current="disputes" />
        <h1 className="text-2xl font-semibold tracking-tight">Disputes</h1>
        <p className="text-sm text-muted-foreground">
          Open reports from training and the Daily Challenge. Accept adds the
          player&apos;s answer as an alias and regrades that attempt. A Daily
          Challenge accept also recomputes that day&apos;s score, which is the
          leaderboard entry.
        </p>
      </div>
      {disputes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open disputes.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {disputes.map((dispute) => (
            <li
              key={dispute.id}
              className="flex flex-col gap-2 rounded-xl border border-border px-4 py-4"
            >
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {dispute.mode} · {dispute.username} · {formatWhen(dispute.createdAt)}
              </p>
              <p className="text-sm leading-relaxed">{dispute.prompt ?? "Question unavailable"}</p>
              <p className="text-sm">
                Your answer: <span className="font-medium">{dispute.userAnswer}</span>
              </p>
              <p className="text-sm">
                Answer: <span className="font-medium">{dispute.correctAnswer}</span>
              </p>
              <DisputeActions id={dispute.id} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
