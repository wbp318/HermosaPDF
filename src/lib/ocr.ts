import { createWorker } from "tesseract.js";
import { renderPageToCanvas, type PDFDocumentProxy } from "./pdf";

export interface OcrWord {
  text: string;
  // Top-left PDF-point coordinates
  x: number;
  y: number;
  w: number;
  h: number;
  size: number; // estimated font size in points
}

export interface OcrPage {
  pageId: number;
  words: OcrWord[];
}

export interface OcrSummary {
  results: OcrPage[];
  ocrdPages: number[]; // 1-indexed positions that were OCR'd
  skippedPages: number[]; // 1-indexed positions that already had text
}

export type OcrProgress = (info: {
  pageIndex: number;
  pageTotal: number;
  message: string;
}) => void;

const OCR_SCALE = 3; // ~216 DPI
// A page is considered already searchable if extracting via pdfjs returns
// more than this many non-whitespace characters.
const TEXT_THRESHOLD_CHARS = 20;

async function pageTextLength(
  doc: PDFDocumentProxy,
  pageNumber: number,
): Promise<number> {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  let total = 0;
  for (const item of content.items) {
    if ("str" in item) total += item.str.trim().length;
  }
  return total;
}

export async function runOcrOnDoc(
  doc: PDFDocumentProxy,
  pageIds: number[],
  onProgress: OcrProgress,
): Promise<OcrSummary> {
  const total = doc.numPages;

  // Pre-pass: classify each page by whether it already has real text
  const needsOcr: number[] = [];
  const skipped: number[] = [];
  for (let i = 1; i <= total; i++) {
    onProgress({
      pageIndex: i,
      pageTotal: total,
      message: `Scanning page ${i} for existing text…`,
    });
    const len = await pageTextLength(doc, i);
    if (len > TEXT_THRESHOLD_CHARS) skipped.push(i);
    else needsOcr.push(i);
  }

  if (needsOcr.length === 0) {
    return { results: [], ocrdPages: [], skippedPages: skipped };
  }

  onProgress({
    pageIndex: 0,
    pageTotal: needsOcr.length,
    message: "Loading OCR engine…",
  });
  const worker = await createWorker("eng");

  const results: OcrPage[] = [];
  const canvas = document.createElement("canvas");

  try {
    let done = 0;
    for (const pageNumber of needsOcr) {
      done++;
      onProgress({
        pageIndex: done,
        pageTotal: needsOcr.length,
        message: `Recognizing page ${pageNumber}…`,
      });
      const page = await doc.getPage(pageNumber);
      await renderPageToCanvas(page, canvas, OCR_SCALE);
      const { data } = await worker.recognize(canvas);

      const rawWords: Array<{
        text?: string;
        bbox?: { x0: number; y0: number; x1: number; y1: number };
      }> = (data as {
        words?: Array<{
          text?: string;
          bbox?: { x0: number; y0: number; x1: number; y1: number };
        }>;
      }).words ?? [];

      const words: OcrWord[] = [];
      for (const w of rawWords) {
        if (!w.text || !w.bbox) continue;
        const t = w.text.trim();
        if (!t) continue;
        const widthPt = (w.bbox.x1 - w.bbox.x0) / OCR_SCALE;
        const heightPt = (w.bbox.y1 - w.bbox.y0) / OCR_SCALE;
        words.push({
          text: t,
          x: w.bbox.x0 / OCR_SCALE,
          y: w.bbox.y0 / OCR_SCALE,
          w: widthPt,
          h: heightPt,
          size: heightPt * 0.85,
        });
      }

      results.push({
        pageId: pageIds[pageNumber - 1] ?? pageNumber,
        words,
      });
    }
  } finally {
    await worker.terminate();
  }

  return { results, ocrdPages: needsOcr, skippedPages: skipped };
}
