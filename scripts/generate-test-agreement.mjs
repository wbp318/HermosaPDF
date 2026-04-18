// Generates a sample signable agreement PDF for testing e-signatures.
// Run with: node scripts/generate-test-agreement.mjs
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "test-fixtures", "agreement.pdf");

const doc = await PDFDocument.create();
const helv = await doc.embedFont(StandardFonts.Helvetica);
const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
const page = doc.addPage([612, 792]); // US Letter
const { width } = page.getSize();
const left = 72;
let y = 720;
const ink = rgb(0.1, 0.1, 0.12);

page.drawText("SAMPLE AGREEMENT", {
  x: left,
  y,
  font: helvBold,
  size: 20,
  color: ink,
});
y -= 14;
page.drawLine({
  start: { x: left, y },
  end: { x: width - left, y },
  thickness: 1,
  color: ink,
});
y -= 34;

const paragraphs = [
  "This Sample Agreement (the \u201CAgreement\u201D) is entered into between HermosaPDF (the \u201CCompany\u201D) and the undersigned (the \u201CClient\u201D) for the purpose of demonstrating the e-signature workflow inside HermosaPDF. No actual consideration or legal rights are exchanged.",
  "1. Purpose. The Company provides a desktop application for editing, organizing, and signing PDF documents. The Client agrees to use this document solely to exercise the application\u2019s signature tools.",
  "2. Non-binding. The parties acknowledge that this document is a test fixture. Nothing in it creates an obligation, grants any license, or transfers any property.",
  "3. Feedback. The Client may provide feedback on the signature experience, including drawing, typing, uploading, placing, resizing, and flattening signatures on saved PDFs.",
  "4. Entire Agreement. This single page constitutes the entire Agreement between the parties with respect to its stated purpose. It supersedes any prior Post-it notes, chat messages, or verbal pinky swears.",
];

for (const p of paragraphs) {
  y = drawWrapped(page, p, helv, 11, left, y, width - left * 2, 15, ink);
  y -= 8;
}

// Signature block
y -= 40;
drawSignatureLine(page, helv, helvBold, left, y, "Client signature", "Date");
y -= 80;
drawSignatureLine(page, helv, helvBold, left, y, "Company representative", "Date");

writeFileSync(out, await doc.save());
console.log(`Wrote ${out}`);

function drawWrapped(page, text, font, size, x, y, maxWidth, lineHeight, color) {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    const w = font.widthOfTextAtSize(next, size);
    if (w > maxWidth) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

function drawSignatureLine(page, helv, helvBold, x, y, label, dateLabel) {
  // Signature line
  const sigWidth = 280;
  page.drawLine({
    start: { x, y },
    end: { x: x + sigWidth, y },
    thickness: 0.75,
    color: rgb(0.2, 0.2, 0.25),
  });
  page.drawText(label, {
    x,
    y: y - 14,
    size: 9,
    font: helv,
    color: rgb(0.35, 0.35, 0.4),
  });
  // Date line
  const dateX = x + sigWidth + 40;
  const dateWidth = 120;
  page.drawLine({
    start: { x: dateX, y },
    end: { x: dateX + dateWidth, y },
    thickness: 0.75,
    color: rgb(0.2, 0.2, 0.25),
  });
  page.drawText(dateLabel, {
    x: dateX,
    y: y - 14,
    size: 9,
    font: helv,
    color: rgb(0.35, 0.35, 0.4),
  });
}
