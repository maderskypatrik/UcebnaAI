import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export const metadata = { title: "Ochrana osobních údajů · Učebna.ai" };

// Who runs Učebna.ai and where teachers can write.
const OPERATOR = "Patrik Maderský";
const CONTACT = "pmadersky@gmail.com";
const UPDATED = "24. 10. 2026";

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-title-lg font-bold text-on-surface">{title}</h2>
      <div className="flex flex-col gap-3 text-body-lg text-on-surface-variant">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <AppShell title="Ochrana osobních údajů" subtitle={`Platí od ${UPDATED}.`}>
      <div className="flex max-w-2xl flex-col gap-10">
        <Part title="Kdo údaje zpracovává">
          <p>
            Správcem osobních údajů je {OPERATOR}. S dotazy nebo žádostmi pište na{" "}
            <a href={`mailto:${CONTACT}`} className="font-medium text-primary-container">
              {CONTACT}
            </a>
            .
          </p>
        </Part>

        <Part title="Jaké údaje a proč">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong className="text-on-surface">E-mail</strong>, abyste se mohli přihlásit a měli své testy jen pro
              sebe.
            </li>
            <li>
              <strong className="text-on-surface">Vytvořené testy a pracovní listy</strong> včetně vašich úprav, aby
              zůstaly v Kabinetu, dokud je sami nesmažete.
            </li>
            <li>
              <strong className="text-on-surface">Počet vytvořených testů za den a spotřeba výpočtu</strong>, kvůli
              dennímu limitu a sledování nákladů provozu.
            </li>
          </ul>
          <p>
            Zpracování je nutné k tomu, abychom vám službu mohli poskytovat (čl. 6 odst. 1 písm. b GDPR). Údaje
            neprodáváme, nepoužíváme k reklamě a neposíláme je nikomu dalšímu než zpracovatelům níže.
          </p>
        </Part>

        <Part title="Nahrané podklady">
          <p>
            Fotky, PDF, prezentace a odkazy, ze kterých test vzniká, se pošlou k jednorázovému zpracování umělé
            inteligenci a neukládají se. Uloží se jen hotový test.
          </p>
          <p>
            Prosíme, nenahrávejte podklady se jmény, známkami nebo jinými údaji o žácích. Aplikace je k tvorbě testů
            nepotřebuje.
          </p>
        </Part>

        <Part title="Zpracovatelé">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong className="text-on-surface">Supabase</strong>: přihlášení a databáze s Kabinetem.
            </li>
            <li>
              <strong className="text-on-surface">Vercel</strong>: provoz webu.
            </li>
            <li>
              <strong className="text-on-surface">Anthropic</strong>: model Claude, který z podkladů připraví test.
              Podle svých podmínek pro API data nepoužívá k trénování modelů.
            </li>
          </ul>
          <p>
            Někteří zpracovatelé sídlí v USA. Předání údajů se řídí standardními smluvními doložkami EU nebo rámcem
            EU–US Data Privacy Framework.
          </p>
        </Part>

        <Part title="Jak dlouho">
          <p>
            Testy a účet uchováváme, dokud službu používáte. Smazaný test se smaže hned. Pokud chcete smazat celý účet
            i se všemi testy, napište nám a do 30 dnů to uděláme.
          </p>
        </Part>

        <Part title="Vaše práva">
          <p>
            Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a vznést
            námitku. Stížnost můžete podat u Úřadu pro ochranu osobních údajů (uoou.gov.cz).
          </p>
        </Part>
      </div>
    </AppShell>
  );
}
