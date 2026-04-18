# HermosaPDF

A personal PDF editing suite — a desktop app covering what Adobe Acrobat does:
text/image editing, page organization, conversion to/from PDF, e-signatures, OCR,
and AI-assisted document analysis.

> Prior Python scripts are preserved under `archive/`.

## Stack

- **Tauri v2** — Rust backend, system WebView2 on Windows
- **React 19 + TypeScript + Vite** — UI
- **pdfjs-dist** — rendering
- **pdf-lib** — page manipulation
- **lopdf (Rust)** — decryption and structural normalization
- **tesseract.js** *(later)* — OCR
- **@anthropic-ai/sdk** *(later)* — AI features via Claude

## Prerequisites (Windows)

1. Node.js 20+
2. Rust (install via [rustup](https://www.rust-lang.org/learn/get-started))
3. Visual Studio 2022 Build Tools with "Desktop development with C++" workload
4. Windows 11 SDK (install via the VS Installer if not already present)

## Develop

```bash
npm install
npm run tauri dev
```

The first `tauri dev` compiles the Rust dependencies; subsequent runs are fast.

## Build a release

```bash
npm run tauri build
```

Produces a Windows installer under `src-tauri/target/release/bundle/`.

## Roadmap

1. ✅ Phase 1 — PDF viewer with thumbnails, open/close, zoom, paging
2. Phase 2 — Page ops: rotate, delete, insert blank, extract, merge *(in progress)*; reorder and split still to come
3. Phase 3 — Annotations + text/image editing
4. Phase 4 — E-signatures (draw/type/upload, place, flatten)
5. Phase 5 — File conversion (PDF ↔ images, Word/HTML → PDF)
6. Phase 6 — OCR (Tesseract, searchable-PDF output)
7. Phase 7 — AI document analysis (Claude: summarize, Q&A, extract, redact)

## Notes on encrypted PDFs

Every PDF opened is first round-tripped through the Rust `pdf_decrypt` command
(backed by `lopdf`), which transparently decrypts owner-password–only PDFs and
emits a normalized output for the JS layer. Password-protected PDFs get a native
prompt.
