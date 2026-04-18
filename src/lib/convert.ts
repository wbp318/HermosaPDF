import { PDFDocument } from "pdf-lib";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { renderPageToCanvas, type PDFDocumentProxy } from "./pdf";

export type ImageFormat = "png" | "jpeg";

/**
 * Render each page of a pdfjs doc to an image file inside outDir.
 * scale = 2 gives ~144 DPI output.
 */
export async function exportPagesAsImages(
  doc: PDFDocumentProxy,
  outDir: string,
  baseName: string,
  format: ImageFormat = "png",
  scale = 2,
): Promise<string[]> {
  const canvas = document.createElement("canvas");
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const written: string[] = [];
  const pad = Math.max(3, String(doc.numPages).length);

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    await renderPageToCanvas(page, canvas, scale);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
        mime,
        0.92,
      );
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const filename = `${baseName}-page-${String(i).padStart(pad, "0")}.${format}`;
    const fullPath = await join(outDir, filename);
    await writeFile(fullPath, bytes);
    written.push(fullPath);
  }
  return written;
}

/**
 * Extract text content from every page, with a "--- Page N ---" separator.
 */
export async function extractPdfText(doc: PDFDocumentProxy): Promise<string> {
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let current: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      const transform = (item as { transform?: number[] }).transform;
      const y = transform ? transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        if (current.length) lines.push(current.join(""));
        current = [];
      }
      current.push(str);
      if (y !== null) lastY = y;
    }
    if (current.length) lines.push(current.join(""));
    parts.push(`--- Page ${i} ---\n\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

/**
 * Build a PDF from a list of image file paths. One image per page, sized to
 * match the image's pixel dimensions.
 */
export async function imagesToPdf(imagePaths: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const path of imagePaths) {
    const bytes = await readFile(path);
    const ext = path.toLowerCase().split(".").pop();
    const embed =
      ext === "png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    const page = doc.addPage([embed.width, embed.height]);
    page.drawImage(embed, { x: 0, y: 0, width: embed.width, height: embed.height });
  }
  return doc.save();
}
