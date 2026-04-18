import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { Annotation } from "./annotations";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(
  bytes: Uint8Array,
  password?: string,
): Promise<PDFDocumentProxy> {
  // pdfjs transfers the underlying ArrayBuffer to its worker, which detaches
  // the original in the main thread. Hand it a disposable copy so our caller's
  // bytes stay intact for pdf-lib editing.
  const copy = Uint8Array.from(bytes);
  const loadingTask = pdfjsLib.getDocument({ data: copy, password });
  return loadingTask.promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const viewport = page.getViewport({ scale });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
  await page.render({
    canvasContext: ctx,
    viewport,
    transform,
  } as Parameters<typeof page.render>[0]).promise;
}

export async function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes);
    return false;
  } catch (e) {
    const msg = (e as Error)?.message ?? "";
    return /encrypt/i.test(msg);
  }
}

async function editBytes(
  bytes: Uint8Array,
  fn: (doc: PDFDocument) => Promise<void> | void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  await fn(doc);
  return doc.save();
}

export async function deletePage(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  return editBytes(bytes, (d) => {
    d.removePage(pageIndex);
  });
}

export async function rotatePage(
  bytes: Uint8Array,
  pageIndex: number,
  deltaDeg: number,
): Promise<Uint8Array> {
  return editBytes(bytes, (d) => {
    const p = d.getPage(pageIndex);
    const next = (p.getRotation().angle + deltaDeg + 360) % 360;
    p.setRotation(degrees(next));
  });
}

export async function insertBlankPage(
  bytes: Uint8Array,
  atIndex: number,
): Promise<Uint8Array> {
  return editBytes(bytes, (d) => {
    const src = d.getPageCount() > 0 ? d.getPage(Math.max(0, atIndex - 1)) : null;
    const size: [number, number] = src ? [src.getWidth(), src.getHeight()] : [612, 792];
    d.insertPage(atIndex, size);
  });
}

export async function mergeAppend(
  bytes: Uint8Array,
  otherBytes: Uint8Array,
): Promise<Uint8Array> {
  const dst = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const src = await PDFDocument.load(otherBytes, { ignoreEncryption: true });
  const copied = await dst.copyPages(src, src.getPageIndices());
  copied.forEach((p) => dst.addPage(p));
  return dst.save();
}

export async function extractPages(
  bytes: Uint8Array,
  pageIndices: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const dst = await PDFDocument.create();
  const copied = await dst.copyPages(src, pageIndices);
  copied.forEach((p) => dst.addPage(p));
  return dst.save();
}

export async function reorderPages(
  bytes: Uint8Array,
  newOrder: number[],
): Promise<Uint8Array> {
  return editBytes(bytes, (d) => {
    const pages = d.getPages().slice();
    for (let i = d.getPageCount() - 1; i >= 0; i--) d.removePage(i);
    newOrder.forEach((oldIdx, newIdx) => d.insertPage(newIdx, pages[oldIdx]));
  });
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Bake in-memory annotations into the PDF bytes. Annotations are keyed by
 * pageId (our stable identity); pageIds maps current position → pageId.
 * Coordinate convention inside the app is top-left (pdfjs). pdf-lib uses
 * bottom-left, so we flip y against each page's height.
 */
export async function flattenAnnotations(
  bytes: Uint8Array,
  annotations: Annotation[],
  pageIds: number[],
): Promise<Uint8Array> {
  if (annotations.length === 0) return bytes;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);

  doc.getPages().forEach((page, idx) => {
    const pageId = pageIds[idx];
    if (pageId === undefined) return;
    const pageAnns = annotations.filter((a) => a.pageId === pageId);
    if (pageAnns.length === 0) return;
    const { height } = page.getSize();

    for (const a of pageAnns) {
      if (a.type === "freehand") {
        const color = hexToRgb(a.color);
        const path = a.points
          .map(
            ([x, y], i) =>
              `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${(height - y).toFixed(2)}`,
          )
          .join(" ");
        page.drawSvgPath(path, {
          borderColor: color,
          borderWidth: a.width,
          borderLineCap: 1,
        });
      } else if (a.type === "text") {
        page.drawText(a.content, {
          x: a.x,
          y: height - a.y - a.fontSize,
          size: a.fontSize,
          color: hexToRgb(a.color),
          font,
        });
      } else if (a.type === "sticky") {
        const color = hexToRgb(a.color);
        page.drawCircle({
          x: a.x,
          y: height - a.y,
          size: 6,
          color,
        });
        page.drawText(a.content, {
          x: a.x + 12,
          y: height - a.y - 4,
          size: 10,
          color: rgb(0.1, 0.1, 0.1),
          font,
        });
      }
    }
  });

  // Signatures: embed PNGs and drawImage. Keep the per-page loop simple by
  // doing it as a second pass so the async embed doesn't interleave with
  // the synchronous drawing ops above.
  for (let idx = 0; idx < doc.getPageCount(); idx++) {
    const page = doc.getPage(idx);
    const pageId = pageIds[idx];
    if (pageId === undefined) continue;
    const sigs = annotations.filter(
      (a): a is Extract<Annotation, { type: "signature" }> =>
        a.type === "signature" && a.pageId === pageId,
    );
    if (sigs.length === 0) continue;
    const { height } = page.getSize();
    for (const sig of sigs) {
      const base64 = sig.dataUrl.split(",")[1];
      if (!base64) continue;
      const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const embed = await doc.embedPng(binary);
      page.drawImage(embed, {
        x: sig.x,
        y: height - sig.y - sig.height,
        width: sig.width,
        height: sig.height,
      });
    }
  }

  return doc.save();
}

export type { PDFDocumentProxy, PDFPageProxy };
