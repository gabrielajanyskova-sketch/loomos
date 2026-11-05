/**
 * Builds the terms and conditions as an A4 PDF from obchodni-podminky.html, so the PDF sent with
 * every order confirmation (textual form, § 1824 OZ) always matches the page on the website.
 */
import { readFile } from "node:fs/promises";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
};
const plain = (html) =>
  html
    // Line breaks in the HTML source are only formatting; <br> is a real break.
    .replace(/\s+/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&([a-z0-9#]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

/** Headings, paragraphs and list items of <main>, in reading order (breadcrumb skipped). */
export function termsBlocks(html) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const blocks = [];
  const re = /<(h1|h2|h3|p|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const [, tag, attrs, inner] of main.matchAll(re)) {
    const text = plain(inner);
    // Elements only for the web page (e.g. the PDF download link) stay out of the PDF.
    if (text && !/no-pdf/.test(attrs))
      blocks.push({ tag: tag.toLowerCase(), text, muted: /muted/.test(attrs) });
  }
  return blocks;
}

export async function termsPdf(root) {
  const html = await readFile(`${root}/obchodni-podminky.html`, "utf8");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = (name) => readFile(`${root}/src/server/fonts/${name}`);
  const regular = await pdf.embedFont(await font("dm-sans-regular.bin"), {
    subset: true,
  });
  const bold = await pdf.embedFont(await font("dm-sans-bold.bin"), {
    subset: true,
  });
  const logo = await pdf.embedPng(
    await readFile(`${root}/src/server/media/logo.bin`),
  );
  pdf.setTitle("Obchodní podmínky LOOMOS");
  pdf.setAuthor("Gabriela Janýšková");
  pdf.setCreator("LOOMOS");

  const W = 595.28;
  const H = 841.89;
  const left = 56;
  const width = W - 2 * left;
  const ink = rgb(0.13, 0.12, 0.11);
  const muted = rgb(0.42, 0.39, 0.36);
  const copper = rgb(0.62, 0.42, 0.26);
  let page;
  let y;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - 60;
  };
  newPage();
  const logoH = 50;
  page.drawImage(logo, {
    x: left,
    y: y - logoH + 12,
    width: (logo.width / logo.height) * logoH,
    height: logoH,
  });
  y -= logoH + 26;

  /** Draws text wrapped to the column; returns nothing, moves y down. */
  const write = (
    text,
    { size, f = regular, color = ink, lead = 1.45, indent = 0, bullet = "" },
  ) => {
    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(" ");
      let line = "";
      const lines = [];
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > width - indent && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      lines.forEach((l, i) => {
        if (y < 70) newPage();
        if (bullet && i === 0)
          page.drawText(bullet, {
            x: left + indent - 10,
            y,
            size,
            font: f,
            color,
          });
        page.drawText(l, { x: left + indent, y, size, font: f, color });
        y -= size * lead;
      });
    }
  };
  for (const b of termsBlocks(html)) {
    if (b.tag === "h1") {
      write(b.text.replace(/\.$/, ""), { size: 22, f: bold });
      y -= 4;
    } else if (b.tag === "h2" || b.tag === "h3") {
      if (y < 140) newPage();
      y -= 10;
      write(b.text, {
        size: b.tag === "h2" ? 13 : 11.5,
        f: bold,
        color: copper,
      });
      y -= 2;
    } else if (b.tag === "li") {
      write(b.text, { size: 9.5, indent: 14, bullet: "•" });
      y -= 2;
    } else {
      write(b.text, { size: 9.5, color: b.muted ? muted : ink });
      y -= 6;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(
      `Obchodní podmínky LOOMOS · loomos.cz · strana ${i + 1} z ${pages.length}`,
      {
        x: left,
        y: 36,
        size: 8,
        font: regular,
        color: muted,
      },
    ),
  );
  return pdf.save();
}
