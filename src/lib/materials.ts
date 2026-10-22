import type Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";

type Block = Anthropic.Beta.BetaContentBlockParam;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const MAX_WEB_CHARS = 60_000;

/** Pulls the visible text out of every slide of a .pptx file, in slide order. */
async function pptxToText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

  const parts: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.files[name].async("string");
    const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(" ");
    if (text.trim()) parts.push(`Snímek ${i + 1}: ${text}`);
  }
  return parts.join("\n");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Fetches a web page and reduces it to readable text. */
async function webPageToText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Odkaz musí začínat http:// nebo https://");
  }
  const res = await fetch(parsed, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; UcebnaAI/1.0)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Stránku se nepodařilo načíst (chyba ${res.status}).`);
  const html = await res.text();
  const text = decodeXml(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return text.slice(0, MAX_WEB_CHARS);
}

/** Turns uploaded files and an optional link into content blocks Claude can read. */
export async function materialsToBlocks(files: File[], url: string): Promise<Block[]> {
  const blocks: Block[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const name = file.name.toLowerCase();

    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: Buffer.from(buffer).toString("base64"),
        },
        title: file.name,
      });
    } else if (IMAGE_TYPES.includes(file.type as ImageType)) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type as ImageType,
          data: Buffer.from(buffer).toString("base64"),
        },
      });
    } else if (name.endsWith(".pptx")) {
      const text = await pptxToText(buffer);
      blocks.push({ type: "text", text: `Prezentace „${file.name}“:\n${text}` });
    } else {
      throw new Error(`Soubor „${file.name}“ neumíme přečíst. Použijte fotku, PDF nebo PPTX.`);
    }
  }

  if (url) {
    const text = await webPageToText(url);
    blocks.push({ type: "text", text: `Webová stránka ${url}:\n${text}` });
  }

  return blocks;
}
