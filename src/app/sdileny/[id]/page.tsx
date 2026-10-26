import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SharedSheet } from "@/components/SharedSheet";

export const metadata = { title: "Sdílený test · Učebna.ai" };

export default function SharedSheetPage({ params }: PageProps<"/sdileny/[id]">) {
  return (
    <AppShell title="Sdílený test">
      <Suspense fallback={<p className="text-body-lg text-on-surface-variant">Načítám…</p>}>
        <SharedSheetLoader params={params} />
      </Suspense>
    </AppShell>
  );
}

async function SharedSheetLoader({ params }: { params: PageProps<"/sdileny/[id]">["params"] }) {
  const { id } = await params;
  return <SharedSheet shareId={id} />;
}
