export type SchoolType = {
  id: string;
  name: string;
  hint: string;
  grades: string[];
};

const numbered = (count: number, word: string) =>
  Array.from({ length: count }, (_, i) => `${i + 1}. ${word}`);

const LATIN = ["Prima", "Sekunda", "Tercie", "Kvarta", "Kvinta", "Sexta", "Septima", "Oktáva"];

export const SCHOOL_TYPES: SchoolType[] = [
  { id: "zs", name: "Základní škola", hint: "1.–9. třída", grades: numbered(9, "třída") },
  { id: "gym4", name: "Gymnázium čtyřleté", hint: "1.–4. ročník", grades: numbered(4, "ročník") },
  { id: "gym6", name: "Gymnázium šestileté", hint: "prima–sexta", grades: LATIN.slice(0, 6) },
  { id: "gym8", name: "Gymnázium osmileté", hint: "prima–oktáva", grades: LATIN },
  { id: "sos", name: "Střední odborná škola", hint: "1.–4. ročník", grades: numbered(4, "ročník") },
  { id: "sou", name: "Střední odborné učiliště", hint: "1.–3. ročník", grades: numbered(3, "ročník") },
];

export const SUBJECTS = [
  "Český jazyk",
  "Matematika",
  "Anglický jazyk",
  "Německý jazyk",
  "Prvouka",
  "Přírodověda",
  "Vlastivěda",
  "Přírodopis / Biologie",
  "Dějepis",
  "Zeměpis",
  "Fyzika",
  "Chemie",
  "Informatika",
  "Občanská výchova / ZSV",
];

/** The first five years of primary school (1. stupeň), where pupils get plainer language and large print. */
export const isYoung = (schoolId: string, grade: string) => schoolId === "zs" && /^[1-5]\./.test(grade);
