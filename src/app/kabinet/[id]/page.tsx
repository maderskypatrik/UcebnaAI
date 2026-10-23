import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SavedSheet } from "@/components/Kabinet";

export const metadata = { title: "Kabinet · Učebna.ai" };

export default function SavedSheetPage({ params }: PageProps<"/kabinet/[id]">) {
  return (
    <AppShell active="kabinet" title="Kabinet">
      <Suspense fallback={<p className="text-body-lg text-on-surface-variant">Načítám…</p>}>
        <SavedSheetLoader params={params} />
      </Suspense>
    </AppShell>
  );
}

async function SavedSheetLoader({ params }: { params: PageProps<"/kabinet/[id]">["params"] }) {
  const { id } = await params;
  return <SavedSheet id={id} />;
}
