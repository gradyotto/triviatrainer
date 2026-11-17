import type { Metadata } from "next";
import { TrainSession } from "@/components/train/train-session";
import { isClerkConfigured } from "@/lib/env";
import { listCategories } from "@/lib/questions";

export const metadata: Metadata = {
  title: "Train",
};

export default async function TrainPage() {
  const { categories } = await listCategories();

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <TrainSession
        categories={categories}
        accountsEnabled={isClerkConfigured()}
      />
    </main>
  );
}
