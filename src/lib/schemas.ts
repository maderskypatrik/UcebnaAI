import { z } from "zod";

export const TestSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number().int(),
      explanation: z.string(),
    }),
  ),
});

export const WorksheetSchema = z.object({
  title: z.string(),
  instructions: z.string(),
  tasks: z.array(
    z.object({
      kind: z.enum(["fill_blank", "short_answer", "matching", "true_false", "open"]),
      prompt: z.string(),
      items: z.array(z.string()),
      answer: z.string(),
    }),
  ),
});

export type Test = z.infer<typeof TestSchema>;
export type Worksheet = z.infer<typeof WorksheetSchema>;

export type GenerateResult =
  | { kind: "test"; data: Test }
  | { kind: "worksheet"; data: Worksheet };

export const TASK_KIND_LABELS: Record<Worksheet["tasks"][number]["kind"], string> = {
  fill_blank: "Doplňte",
  short_answer: "Odpovězte",
  matching: "Přiřaďte",
  true_false: "Pravda, nebo nepravda?",
  open: "Úloha",
};
