import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { PDFDocument, degrees } from "pdf-lib";

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

export type { PDFDocumentProxy, PDFPageProxy };
