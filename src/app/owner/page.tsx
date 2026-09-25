import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "My properties" };

// Placeholder until the owner view (milestone 4).
export default async function OwnerPage() {
  const user = await requireRole("owner");

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-3xl p-4">
        <h1 className="text-xl font-semibold">My properties</h1>
        <p className="mt-2 text-slate-600">The owner calendar is coming soon.</p>
      </main>
    </>
  );
}
