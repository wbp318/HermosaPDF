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
  flattenAnnotations,
  type PDFDocumentProxy,
} from "./pdf";
import {
  loadSignatures,
  persistSignatures,
  type Annotation,
  type SignatureAsset,
  type Tool,
} from "./annotations";

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
  // Persistent identity for each current page position (1-indexed by position).
  // Starts as 1..N; reorders/deletes/inserts/merges keep each existing page's
  // identity label stable so a page that originated at position 2 still shows
  // "2" after it's moved.
  pageIds: number[];

  // Annotation layer state
  tool: Tool;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  annotationColor: string;
  strokeWidth: number;

  setTool: (t: Tool) => void;
  addAnnotation: (a: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  setSelectedAnnotation: (id: string | null) => void;
  setAnnotationColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;

  // Signature library + pending placement
  signatures: SignatureAsset[];
  pendingSignatureId: string | null;
  addSignature: (a: SignatureAsset) => void;
  removeSignature: (id: string) => void;
  setPendingSignature: (id: string | null) => void;

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
  pageIds: [],
  tool: "select",
  annotations: [],
  selectedAnnotationId: null,
  annotationColor: "#ff3b30",
  strokeWidth: 2,
  signatures: loadSignatures(),
  pendingSignatureId: null,

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
        pageIds: Array.from({ length: doc.numPages }, (_, i) => i + 1),
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
      pageIds: [],
      annotations: [],
      selectedAnnotationId: null,
      tool: "select",
    });
  },

  setTool: (t) => set({ tool: t, selectedAnnotationId: null }),

  addAnnotation: (a) =>
    set((s) => ({
      annotations: [...s.annotations, a],
      selectedAnnotationId: a.id,
      dirty: true,
    })),

  updateAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Annotation) : a,
      ),
      dirty: true,
    })),

  removeAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
      dirty: true,
    })),

  setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),
  setAnnotationColor: (c) => set({ annotationColor: c }),
  setStrokeWidth: (w) => set({ strokeWidth: Math.max(0.5, Math.min(20, w)) }),

  addSignature: (sig) =>
    set((s) => {
      const next = [...s.signatures, sig];
      persistSignatures(next);
      return { signatures: next };
    }),

  removeSignature: (id) =>
    set((s) => {
      const next = s.signatures.filter((x) => x.id !== id);
      persistSignatures(next);
      return {
        signatures: next,
        pendingSignatureId: s.pendingSignatureId === id ? null : s.pendingSignatureId,
      };
    }),

  setPendingSignature: (id) =>
    set((s) => {
      if (id && !s.signatures.find((x) => x.id === id)) return {};
      return {
        pendingSignatureId: id,
        tool: id ? "sign" : s.tool === "sign" ? "select" : s.tool,
      };
    }),

  deletePage: async (pageIndex) => {
    const { bytes, doc, currentPage, numPages, pageIds } = get();
    if (!bytes || numPages <= 1) return;
    set({ busy: true, error: null });
    try {
      const next = await deletePageBytes(bytes, pageIndex);
      const newDoc = await reloadDoc(doc, next);
      const newNum = newDoc.numPages;
      const newCurrent = Math.min(currentPage, newNum);
      const newPageIds = pageIds.filter((_, i) => i !== pageIndex);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newNum,
        currentPage: newCurrent,
        dirty: true,
        busy: false,
        pageIds: newPageIds,
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
    const { bytes, doc, pageIds } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const next = await insertBlankPageBytes(bytes, atIndex);
      const newDoc = await reloadDoc(doc, next);
      const newId = (pageIds.length ? Math.max(...pageIds) : 0) + 1;
      const newPageIds = [
        ...pageIds.slice(0, atIndex),
        newId,
        ...pageIds.slice(atIndex),
      ];
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
        pageIds: newPageIds,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  mergeFromDialog: async () => {
    const { bytes, doc, pageIds } = get();
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
      const baseMax = pageIds.length ? Math.max(...pageIds) : 0;
      const appendedCount = newDoc.numPages - pageIds.length;
      const newPageIds = [
        ...pageIds,
        ...Array.from({ length: appendedCount }, (_, i) => baseMax + i + 1),
      ];
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
        pageIds: newPageIds,
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
    const { bytes, doc, pageIds } = get();
    if (!bytes) return;
    set({ busy: true, error: null });
    try {
      const next = await reorderPagesBytes(bytes, newOrder);
      const newDoc = await reloadDoc(doc, next);
      const newPageIds = newOrder.map((i) => pageIds[i] ?? i + 1);
      set({
        bytes: next,
        doc: newDoc,
        numPages: newDoc.numPages,
        dirty: true,
        busy: false,
        pageIds: newPageIds,
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
    const fromIdx = fromPageNumber - 1;
    const toIdx = toPageNumber - 1;
    const order = Array.from({ length: numPages }, (_, i) => i);
    const [moved] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, moved);
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
    const { bytes, filePath, annotations, pageIds } = get();
    if (!bytes) return;
    if (!filePath) {
      return get().saveAs();
    }
    set({ busy: true, error: null });
    try {
      const out = await flattenAnnotations(bytes, annotations, pageIds);
      await writePdf(filePath, out);
      set({ bytes: out, annotations: [], dirty: false, busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  saveAs: async () => {
    const { bytes, filePath, annotations, pageIds } = get();
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
      const out = await flattenAnnotations(bytes, annotations, pageIds);
      await writePdf(target, out);
      set({
        bytes: out,
        annotations: [],
        filePath: target,
        dirty: false,
        busy: false,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },
}));

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __pdfStore: typeof usePdfStore }).__pdfStore =
    usePdfStore;
}
