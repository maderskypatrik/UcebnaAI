/**
 * Formulas in sheet text. Claude writes math as LaTeX between dollar signs ("$\frac{3}{4}$")
 * and chemistry as mhchem ("$\ce{2H2 + O2 -> 2H2O}$"); a literal dollar sign is "\$".
 * The same text is set as a formula on screen, as an equation in Word and as plain Unicode
 * wherever only text fits (Kahoot, Quizlet, Google Forms).
 */

export type Piece = { type: "text"; value: string } | { type: "math"; tex: string };

// "$…$" opening on a non-space and not closing right before a digit, so "costs $5 and $6" stays text.
const MATH = /(?<!\\)\$(?=\S)((?:\\\$|[^$\n])+?)(?<!\\)\$(?!\d)/g;

export const hasMath = (text: string) => text.includes("$");

export function splitMath(text: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  for (const match of text.matchAll(MATH)) {
    if (match.index > last) pieces.push({ type: "text", value: unescape(text.slice(last, match.index)) });
    pieces.push({ type: "math", tex: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ type: "text", value: unescape(text.slice(last)) });
  return pieces;
}

const unescape = (text: string) => text.replace(/\\\$/g, "$");

/** The inside of "\ce{…}" when the whole formula is chemistry. */
export function chemistry(tex: string): string | null {
  const match = tex.trim().match(/^\\ce\{([\s\S]*)\}$/);
  return match ? match[1] : null;
}

// ── Chemistry as runs of normal, subscript and superscript text ─────────────

export type Run = { text: string; script?: "sub" | "sup" };

const ARROWS: [RegExp, string][] = [
  [/<=>|<->/g, " ⇌ "],
  [/->/g, " → "],
  [/<-/g, " ← "],
];

/** "2H2 + O2 -> 2H2O" → 2H₂ + O₂ → 2H₂O, "SO4^2-" → SO₄²⁻, as runs a Word file can format. */
export function chemRuns(ce: string): Run[] {
  let s = ce;
  for (const [pattern, arrow] of ARROWS) s = s.replace(pattern, arrow);
  s = s.replace(/\s+/g, " ").replace(/ ?([→←⇌]) ?/g, " $1 ").trim();
  const runs: Run[] = [];
  const push = (text: string, script?: Run["script"]) => {
    const prev = runs[runs.length - 1];
    if (prev && prev.script === script) prev.text += text;
    else runs.push({ text, script });
  };
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const sup = rest.match(/^\^\{([^}]*)\}|^\^([0-9]*[+-]|[0-9]+)/);
    if (sup) {
      push((sup[1] ?? sup[2]).replace(/-/g, "−"), "sup");
      i += sup[0].length;
      continue;
    }
    const sub = rest.match(/^_\{([^}]*)\}|^_([0-9]+)/);
    if (sub) {
      push(sub[1] ?? sub[2], "sub");
      i += sub[0].length;
      continue;
    }
    // Digits right after an element or a bracket are atom counts: H2O, (OH)2.
    const count = rest.match(/^[0-9]+/);
    if (count && i > 0 && /[A-Za-z)\]]/.test(s[i - 1])) {
      push(count[0], "sub");
      i += count[0].length;
      continue;
    }
    // A charge at the end of an ion: Na+, Cl-, SO4 2- written as SO42-.
    const charge = rest.match(/^[+-](?=\s|$)/);
    if (charge && i > 0 && /[A-Za-z0-9)\]]/.test(s[i - 1]) && s[i - 1] !== " ") {
      push(charge[0] === "-" ? "−" : "+", "sup");
      i += 1;
      continue;
    }
    push(s[i] === "-" ? "−" : s[i]);
    i += 1;
  }
  return runs;
}

// ── Plain Unicode text ──────────────────────────────────────────────────────

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
};

/** Unicode super- or subscript when every character has one, otherwise ^(…) or _(…). */
function script(text: string, map: Record<string, string>, mark: string) {
  const chars = [...text];
  return chars.every((c) => map[c]) ? chars.map((c) => map[c]).join("") : `${mark}(${text})`;
}

const SYMBOLS: Record<string, string> = {
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠",
  approx: "≈", doteq: "≐", equiv: "≡", infty: "∞", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒",
  Leftrightarrow: "⇔", degree: "°", circ: "°", angle: "∠", perp: "⊥", parallel: "∥", in: "∈", notin: "∉",
  subset: "⊂", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", sum: "∑", int: "∫", partial: "∂",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", varepsilon: "ε", epsilon: "ε", lambda: "λ",
  mu: "μ", pi: "π", rho: "ρ", sigma: "σ", Sigma: "Σ", tau: "τ", varphi: "φ", phi: "φ", omega: "ω", Omega: "Ω",
  ldots: "…", dots: "…", cdots: "⋯", percent: "%", "%": "%", ",": " ", ";": " ", quad: " ", qquad: "  ", " ": " ",
};

/** The argument in braces at `i`, or the single next character. */
function argument(tex: string, i: number): [string, number] {
  while (tex[i] === " ") i++;
  if (tex[i] === "\\") {
    const name = tex.slice(i).match(/^\\([A-Za-z]+|.)/)?.[0] ?? "\\";
    return [name, i + name.length];
  }
  if (tex[i] !== "{") return [tex[i] ?? "", i + 1];
  let depth = 0;
  for (let j = i; j < tex.length; j++) {
    if (tex[j] === "{") depth++;
    if (tex[j] === "}" && --depth === 0) return [tex.slice(i + 1, j), j + 1];
  }
  return [tex.slice(i + 1), tex.length];
}

const grouped = (text: string) => (/^[\w.,]+$|^[^\s+\-−·×/]$/.test(text) ? text : `(${text})`);

/** A readable plain-text version of one formula: \frac{3}{4} → 3/4, x^2 → x², \ce{H2O} → H₂O. */
export function texToPlain(tex: string): string {
  const ce = chemistry(tex);
  if (ce !== null) return chemRuns(ce).map((r) => (r.script ? script(r.text, r.script === "sup" ? SUP : SUB, r.script === "sup" ? "^" : "_") : r.text)).join("");
  let out = "";
  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    if (c === "\\") {
      const name = tex.slice(i + 1).match(/^([A-Za-z]+|.)/)?.[1] ?? "";
      i += 1 + name.length;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [num, a] = argument(tex, i);
        const [den, b] = argument(tex, a);
        out += `${grouped(texToPlain(num))}/${grouped(texToPlain(den))}`;
        i = b;
      } else if (name === "sqrt") {
        let degree = "";
        if (tex[i] === "[") {
          const end = tex.indexOf("]", i);
          degree = tex.slice(i + 1, end);
          i = end + 1;
        }
        const [body, next] = argument(tex, i);
        out += `${degree ? script(degree, SUP, "^") : ""}√${grouped(texToPlain(body))}`;
        i = next;
      } else if (["text", "mathrm", "textrm", "mathbf", "mathit", "operatorname", "ce"].includes(name)) {
        const [body, next] = argument(tex, i);
        out += name === "ce" ? texToPlain(`\\ce{${body}}`) : name.startsWith("text") ? body : texToPlain(body);
        i = next;
      } else if (name === "left" || name === "right" || name === "big" || name === "Big") {
        // Sizing only; the bracket itself follows.
      } else if (name === "\\") {
        out += "; ";
      } else if (name === "begin" || name === "end") {
        i = argument(tex, i)[1];
      } else {
        out += SYMBOLS[name] ?? (/^[a-z]+$/.test(name) ? name : "");
      }
    } else if (c === "^" || c === "_") {
      const [body, next] = argument(tex, i + 1);
      const plain = texToPlain(body);
      out += plain === "°" || body === "\\circ" ? "°" : script(plain, c === "^" ? SUP : SUB, c);
      i = next;
    } else if (c === "{" || c === "}") {
      i++;
    } else if (c === "&") {
      i++;
    } else {
      out += c === "*" ? "·" : c === "-" ? "−" : c;
      i++;
    }
  }
  return out.replace(/\s+/g, " ").replace(/ ;/g, ";").trim();
}

/** Sheet text with every formula turned into plain Unicode, for places that show only text. */
export function toPlain(text: string): string {
  if (!hasMath(text)) return text;
  return splitMath(text)
    .map((p) => (p.type === "text" ? p.value : texToPlain(p.tex)))
    .join("");
}
