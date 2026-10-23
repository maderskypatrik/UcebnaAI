import { AppShell } from "@/components/AppShell";
import { Kabinet } from "@/components/Kabinet";

export const metadata = { title: "Kabinet · Učebna.ai" };

export default function KabinetPage() {
  return (
    <AppShell active="kabinet" title="Kabinet" subtitle="Všechny vaše testy a pracovní listy na jednom místě.">
      <Kabinet />
    </AppShell>
  );
}
