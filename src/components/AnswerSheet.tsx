import { crossword } from "@/lib/puzzles";
import { toPlain } from "@/lib/rich";
import {
  LETTERS,
  STUDENT_LINE,
  matchingKeyLetter,
  orderingShown,
  sectionStarts,
  type Item,
  type Section,
  type Sheet,
} from "@/lib/schemas";

const mark = (on: boolean) =>
  `flex size-6 items-center justify-center rounded-full border text-xs font-semibold [print-color-adjust:exact] ${
    on ? "border-primary-container bg-primary-container text-on-primary" : "border-outline-variant text-on-surface-variant"
  }`;
const box = "flex size-6 items-center justify-center rounded-sm border border-outline-variant text-xs font-semibold text-primary-container";

/** What the student marks or writes for one item; with the key, the right answer in the same place. */
function Answer({ section, item, index, number, showKey }: { section: Section; item: Item; index: number; number: number; showKey: boolean }) {
  const line = (key: string) =>
    showKey ? (
      <span className="truncate font-semibold text-primary-container">{toPlain(key)}</span>
    ) : (
      <span className="h-5 flex-1 border-b border-dotted border-on-surface-variant/60" />
    );
  switch (section.type) {
    case "multiple_choice": {
      const correct = item.answer.trim().toUpperCase().charAt(0);
      return (
        <span className="flex gap-1.5">
          {item.options.map((_, k) => (
            <span key={k} className={mark(showKey && LETTERS[k] === correct)}>
              {LETTERS[k]}
            </span>
          ))}
        </span>
      );
    }
    case "true_false": {
      const correct = item.answer.trim().toUpperCase().charAt(0);
      return (
        <span className="flex gap-1.5">
          {["P", "N"].map((v) => (
            <span key={v} className={mark(showKey && v === correct)}>
              {v}
            </span>
          ))}
        </span>
      );
    }
    case "matching":
      return <span className={box}>{showKey ? matchingKeyLetter(index, section.items.length) : ""}</span>;
    case "ordering":
      return (
        <span className="flex gap-1">
          {orderingShown(item, number).map((entry) => (
            <span key={entry.position} className={box}>
              {showKey ? entry.position : ""}
            </span>
          ))}
        </span>
      );
    case "calculation":
      return line(item.answer.split("\n").at(-1)?.replace(/^Výsledek:\s*/i, "") ?? "");
    case "open":
      return <span className="text-sm text-on-surface-variant">na listu</span>;
    default:
      return line(item.answer.split(" – ")[0]);
  }
}

/**
 * One page where students mark their answers, and the same page with the right ones for
 * the teacher: laid side by side, a test is marked in a minute.
 */
export function AnswerSheet({ sheet, showKey }: { sheet: Sheet; showKey: boolean }) {
  const starts = sectionStarts(sheet);
  return (
    <article className="mx-auto w-full max-w-[210mm] break-before-page bg-surface-container-lowest px-8 py-12 shadow-ambient sm:px-14 print:max-w-none print:p-0 print:shadow-none">
      <p className="mb-8 text-label-md text-on-surface-variant">{sheet.header?.student ?? STUDENT_LINE}</p>
      <h2 className="mb-8 font-display text-title-lg font-bold text-on-surface">
        {showKey ? "Šablona pro opravu" : "Záznamový arch"}
        <span className="ml-2 font-normal text-on-surface-variant">· {toPlain(sheet.title)}</span>
      </h2>
      <div className="flex flex-col gap-8">
        {sheet.sections.map((section, si) => {
          if (section.type === "word_search") return null;
          if (section.type === "crossword") {
            return (
              <section key={si} className="break-inside-avoid">
                <h3 className="mb-3 font-display font-bold text-on-surface">
                  <span className="mr-2 text-primary-container">{LETTERS[si]}</span>
                  {toPlain(section.title)}
                </h3>
                <p className="flex items-center gap-3 text-body-lg">
                  Tajenka:{" "}
                  {showKey ? (
                    <strong className="tracking-widest text-primary-container">{crossword(section.items).solution}</strong>
                  ) : (
                    <span className="h-5 w-48 border-b border-dotted border-on-surface-variant/60" />
                  )}
                </p>
              </section>
            );
          }
          return (
            <section key={si} className="break-inside-avoid">
              <h3 className="mb-3 font-display font-bold text-on-surface">
                <span className="mr-2 text-primary-container">{LETTERS[si]}</span>
                {toPlain(section.title)}
              </h3>
              <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2 print:grid-cols-2">
                {section.items.map((item, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-3 text-body-lg text-on-surface">
                    <span className="w-8 shrink-0 text-right text-on-surface-variant">{starts[si] + i}.</span>
                    <Answer section={section} item={item} index={i} number={starts[si] + i} showKey={showKey} />
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </article>
  );
}
