import type { Sheet } from "./schemas";

/** The test shown on the home page to teachers who haven't signed in yet. */
export const SAMPLE_META = "Přírodopis · Základní škola · 7. třída";

export const SAMPLE_SHEET: Sheet = {
  kind: "test",
  title: "Fotosyntéza",
  instructions: "Pozorně si přečti zadání a odpovídej celými slovy.",
  header: { meta: SAMPLE_META, student: "Jméno: ______________________ Třída: ______ Datum: __________" },
  sections: [
    {
      type: "multiple_choice",
      points: 1,
      title: "Vyber správnou odpověď",
      instructions: "Zakroužkuj jednu správnou možnost.",
      items: [
        {
          prompt: "Ve které části buňky probíhá fotosyntéza?",
          options: ["V mitochondriích", "V chloroplastech", "V jádře", "V buněčné stěně"],
          answer: "B",
        },
        {
          prompt: "Který plyn rostlina při fotosyntéze přijímá?",
          options: ["Kyslík", "Dusík", "Oxid uhličitý", "Vodík"],
          answer: "C",
        },
        {
          prompt: "Co rostlina při fotosyntéze vytváří?",
          options: ["Glukózu a kyslík", "Vodu a dusík", "Bílkoviny a oxid uhličitý", "Tuky a vodík"],
          answer: "A",
        },
      ],
    },
    {
      type: "true_false",
      points: 1,
      title: "Pravda, nebo nepravda?",
      instructions: "U každého tvrzení zakroužkuj P, nebo N.",
      items: [
        { prompt: "Zelenou barvu listům dává chlorofyl.", options: [], answer: "P" },
        { prompt: "Fotosyntéza probíhá jen v noci.", options: [], answer: "N" },
        { prompt: "Kyslík, který dýcháme, vzniká hlavně fotosyntézou.", options: [], answer: "P" },
      ],
    },
    {
      type: "fill_blank",
      points: 1,
      title: "Doplň slova",
      instructions: "Doplň do vět slova z nabídky.",
      items: [
        { prompt: "Energii pro fotosyntézu dodává ____ záření.", options: [], answer: "sluneční" },
        { prompt: "Vodu rostlina přijímá ____.", options: [], answer: "kořeny" },
        { prompt: "Plyny vstupují do listu průduchy na jeho ____ straně.", options: [], answer: "spodní" },
      ],
    },
    {
      type: "short_answer",
      points: 2,
      title: "Odpověz krátce",
      instructions: "Odpověz jednou větou.",
      items: [
        {
          prompt: "Proč je fotosyntéza důležitá i pro živočichy?",
          options: [],
          answer: "Vzniká při ní kyslík a potrava (glukóza), na které závisí ostatní organismy.",
        },
        {
          prompt: "Proč rostlina ve tmě nemůže fotosyntetizovat?",
          options: [],
          answer: "Chybí jí světlo, které fotosyntéza potřebuje jako zdroj energie.",
        },
      ],
    },
  ],
};
