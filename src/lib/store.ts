import { create } from "zustand";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
  loadPdf,
  deletePage as deletePageBytes,
  rotatePage as rotatePageBytes,
  insertBlankPage as insertBlankPageBytes,
  mergeAppend as mergeAppendBytes,
  extractPages as extractPagesBytes,
  reorderPages as reorderPagesBytes,
  type PDFDocumentProxy,
} from "./pdf";

async function normalizePdfBytes(bytes: Uint8Array, password?: string): Promise<Uint8Array> {
  // Round-trip through Rust (lopdf) to decrypt if needed and normalize the
  // structure so downstream pdf-lib edits produce a valid output.
  const out = await invoke<number[] | Uint8Array>("pdf_decrypt", {
    bytes: Array.from(bytes),
    password: password ?? null,
  });
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

interface PdfState {
  doc: PDFDocumentProxy | null;
  bytes: Uint8Array | null;
  filePath: string | null;
  numPages: number;
  currentPage: number;
  zoom: number;
  loading: boolean;
  busy: boolean;
  dirty: boolean;
  error: string | null;

  openFromDialog: () => Promise<void>;
  setPage: (n: number) => void;
  setZoom: (z: number) => void;
  close: () => void;

  deletePage: (pageIndex: number) => Promise<void>;
  rotatePage: (pageIndex: number, deltaDeg: number) => Promise<void>;
  insertBlankAt: (atIndex: number) => Promise<void>;
  mergeFromDialog: () => Promise<void>;
  extractPagesToFile: (pageIndices: number[]) => Promise<void>;
  reorderPages: (newOrder: number[]) => Promise<void>;
  movePage: (fromPageNumber: number, toPageNumber: number) => Promise<void>;
  splitAt: (afterPage: number) => Promise<void>;

  save: () => Promise<void>;
  saveAs: () => Promise<void>;
}

async function reloadDoc(
  prev: PDFDocumentProxy | null,
  bytes: Uint8Array,
): Promise<PDFDocumentProxy> {
  // Load the new doc first so the old one stays valid for in-flight renders.
  // Destroy the old only after the swap succeeds.
  const next = await loadPdf(bytes);
  if (prev) prev.destroy();
  return next;
}

async function writePdf(path: string, bytes: Uint8Array): Promise<void> {
  await writeFile(path, bytes);
}

export const usePdfStore = create<PdfState>((set, get) => ({
  doc: null,
  bytes: null,
  filePath: null,
  numPages: 0,
  currentPage: 1,
  zoom: 1.0,
  loading: false,
  busy: false,
  dirty: false,
  error: null,

  openFromDialog: async () => {
    set({ loading: true, error: null });
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) {
        set({ loading: false });
        return;
      }
      const path = selected;
      const rawBytes = await readFile(path);

      // Round-trip through Rust's lopdf: decrypts transparently and emits a
      // well-formed PDF that pdf-lib can edit safely.
      let bytes: Uint8Array;
      let password: string | undefined;
      for (;;) {
        try {
          bytes = await normalizePdfBytes(rawBytes, password);
          break;
        } catch (e: unknown) {
          const msg = (e as Error)?.message ?? String(e);
          if (/password required|decrypt/i.test(msg)) {
            const entered = window.prompt(
              password
                ? "Wrong password. Try again:"
                : "This PDF is password-protected. Enter password:",
            );
            if (!entered) {
              set({ loading: false });
              return;
            }
            password = entered;
            continue;
          }
          throw e;
        }
      }

      const doc = await loadPdf(bytes);

      const prev = get().doc;
      if (prev) prev.destroy();

      set({
        doc,
        bytes,
        filePath: path,
        numPages: doc.numPages,
        currentPage: 1,
        dirty: false,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  setPage: (n) => {
    const { numPages } = get();
    if (n < 1 || n > numPages) return;
    set({ currentPage: n });
  },

  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(4, z)) }),

  close: () => {
    const { doc } = get();
    if (doc) doc.destroy();
    set({
      doc: null,
      bytes: null,
      filePath: null,
      numPages: 0,
      currentPage: 1,
      dirty: false,
      error: null,
    });
  },

  deletePage: async (pageIndex) => {
    const { bytes, doc, currentPage, numPages } = get();
    if (!bytes || numPages <= 1) return;
    set({ busy: true, error: null });
    try {
      const next = await deletePageBytes(bytes, pageIndex);
      const newDoc = await reloadDoc(doc, next);
      const newNum = newDoc.numPages;
      const newCurrent = Math.min(currentPage, newNum);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newNum,
        currentPage: newCurrent,
        dirty: true,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  rotatePage: async (pageIndex, deltaDeg) => {
    const { bytes, doc } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const next = await rotatePageBytes(bytes, pageIndex, deltaDeg);
      const newDoc = await reloadDoc(doc, next);
      set({ bytes: next, doc: newDoc, dirty: true, busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  insertBlankAt: async (atIndex) => {
    const { bytes, doc } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const next = await insertBlankPageBytes(bytes, atIndex);
      const newDoc = await reloadDoc(doc, next);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  mergeFromDialog: async () => {
    const { bytes, doc } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!selected) {
        set({ busy: false });
        return;
      }
      const otherBytes = await readFile(selected);
      const next = await mergeAppendBytes(bytes, otherBytes);
      const newDoc = await reloadDoc(doc, next);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  extractPagesToFile: async (pageIndices) => {
    const { bytes, filePath } = get();
    if (!bytes || pageIndices.length === 0) return;
    set({ busy: true, error: null });
    try {
      const extracted = await extractPagesBytes(bytes, pageIndices);
      const defaultName = filePath
        ? filePath.replace(/\.pdf$/i, ` (extracted ${pageIndices.length}p).pdf`)
        : "extracted.pdf";
      const target = await save({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!target) {
        set({ busy: false });
        return;
      }
      await writePdf(target, extracted);
      set({ busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  reorderPages: async (newOrder) => {
    const { bytes, doc } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const next = await reorderPagesBytes(bytes, newOrder);
      const newDoc = await reloadDoc(doc, next);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  movePage: async (fromPageNumber, toPageNumber) => {
    const { numPages } = get();
    if (fromPageNumber === toPageNumber) return;
    if (fromPageNumber < 1 || fromPageNumber > numPages) return;
    if (toPageNumber < 1 || toPageNumber > numPages) return;
    const order: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (i === fromPageNumber) continue;
      if (i === toPageNumber) order.push(fromPageNumber - 1);
      order.push(i - 1);
    }
    await get().reorderPages(order);
    set({ currentPage: toPageNumber });
  },

  splitAt: async (afterPage) => {
    const { bytes, numPages, filePath } = get();
    if (!bytes || afterPage < 1 || afterPage >= numPages) return;
    set({ busy: true, error: null });
    try {
      const firstIndices = Array.from({ length: afterPage }, (_, i) => i);
      const secondIndices = Array.from(
        { length: numPages - afterPage },
        (_, i) => i + afterPage,
      );
      const firstBytes = await extractPagesBytes(bytes, firstIndices);
      const secondBytes = await extractPagesBytes(bytes, secondIndices);

      const base = filePath
        ? filePath.replace(/\.pdf$/i, "")
        : "document";
      const firstDefault = `${base} (pages 1-${afterPage}).pdf`;
      const secondDefault = `${base} (pages ${afterPage + 1}-${numPages}).pdf`;

      const firstTarget = await save({
        defaultPath: firstDefault,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!firstTarget) {
        set({ busy: false });
        return;
      }
      await writePdf(firstTarget, firstBytes);

      const secondTarget = await save({
        defaultPath: secondDefault,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (secondTarget) {
        await writePdf(secondTarget, secondBytes);
      }
      set({ busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  save: async () => {
    const { bytes, filePath } = get();
    if (!bytes) return;
    if (!filePath) {
      return get().saveAs();
    }
    set({ busy: true, error: null });
    try {
      await writePdf(filePath, bytes);
      set({ dirty: false, busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  saveAs: async () => {
    const { bytes, filePath } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const target = await save({
        defaultPath: filePath ?? "document.pdf",
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!target) {
        set({ busy: false });
        return;
      }
      await writePdf(target, bytes);
      set({ filePath: target, dirty: false, busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __pdfStore: typeof usePdfStore }).__pdfStore =
    usePdfStore;
}
