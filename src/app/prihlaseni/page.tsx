import { AppShell } from "@/components/AppShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Přihlášení · Učebna.ai" };

export default function LoginPage() {
  return (
    <AppShell title="Přihlášení" subtitle="Po přihlášení se vaše testy ukládají do Kabinetu.">
      <LoginForm />
    </AppShell>
  );
}
