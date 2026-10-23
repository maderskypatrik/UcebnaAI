import { AppShell } from "@/components/AppShell";
import { LessonWizard } from "@/components/LessonWizard";

export default function Home() {
  return (
    <AppShell
      active="new"
      title="Dobrý den, pane učiteli"
      subtitle="Ve třech krocích vytvoříme test nebo pracovní list z vašich materiálů."
    >
      <LessonWizard />
    </AppShell>
  );
}
