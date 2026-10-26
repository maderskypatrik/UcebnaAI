"use client";

import katex from "katex";
import "katex/contrib/mhchem";
import { Fragment, useMemo } from "react";
import { splitMath } from "@/lib/rich";

/** Text with its formulas set like in a textbook, with full-size fractions that students can read. */
export function MathText({ text }: { text: string }) {
  const pieces = useMemo(() => splitMath(text), [text]);
  return pieces.map((piece, i) =>
    piece.type === "text" ? (
      <Fragment key={i}>{piece.value}</Fragment>
    ) : (
      <span
        key={i}
        className="math"
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(`\\displaystyle ${piece.tex}`, { throwOnError: false, strict: "ignore", output: "htmlAndMathml" }),
        }}
      />
    ),
  );
}
