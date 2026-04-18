# HermosaPDF

Personal PDF editing suite — a desktop app that covers what Adobe Acrobat does,
wearing a Windows 98 skin with phosphor-green accents.

> **Copyright © 2026 William Brooks Parker.** All rights reserved. HermosaPDF is
> proprietary software distributed under the terms of [LICENSE.md](LICENSE.md).
> Third-party open-source components are listed in [NOTICE.md](NOTICE.md).

[![Release](https://img.shields.io/badge/release-v0.1.0-0a8a3a)](https://github.com/wbp318/HermosaPDF/releases/tag/v0.1.0)

> The original Python scripts that used to live in this repo are preserved under [archive/](archive/).

## Install

Grab the latest installer from the [**v0.1.0 release**](https://github.com/wbp318/HermosaPDF/releases/tag/v0.1.0):

- **`HermosaPDF_0.1.0_x64-setup.exe`** (NSIS) — smaller, recommended for personal install
- **`HermosaPDF_0.1.0_x64_en-US.msi`** (MSI) — for group-policy / enterprise deploy

The installer is unsigned, so Windows SmartScreen may warn on first run —
*More info → Run anyway*.

## Features

- **Organize** — rotate, delete, insert blank, extract, merge, split, and
  drag-reorder pages. Each page keeps a stable identity label so thumbnails
  stay readable after moves.
- **Annotate** — freehand draw, text boxes, sticky notes, and e-signatures
  (draw / type / upload) with Konva-based resize handles. Annotations
  flatten into the PDF on save.
- **Convert** — PDF ↔ images (PNG/JPEG), PDF → text, bundle images into a PDF.
- **OCR** — Tesseract.js with a pre-scan that skips pages that already have
  selectable text. Output is an invisible text layer, not a duplicate.
- **AI (Claude)** — summarize, Q&A against the doc, extract fields to JSON,
  flag PII. Model tier selector defaults to Haiku 4.5; pick Sonnet 4.6 or
  Opus 4.7 when needed. Prompt caching on the document block.
- **Encrypted PDF support** — every open round-trips through Rust's `lopdf`
  so owner-password PDFs and malformed XRefs just work.
- **Win98 chrome** — custom title bar, menu bar, status bar, chunky
  scrollbars, phosphor-green highlights.

## Stack

- **Tauri v2** — Rust backend, system WebView2 on Windows
- **React 19 + TypeScript + Vite** — UI
- **pdfjs-dist** — rendering
- **pdf-lib** — page manipulation + flatten
- **lopdf** *(Rust)* — decryption + structural normalization
- **konva** + **react-konva** — annotation overlay
- **tesseract.js** — OCR
- **@anthropic-ai/sdk** — Claude API
- **keyring** *(Rust)* — OS-keychain storage for the Anthropic key
- **zustand** — state management

## Architecture

```
[Disk .pdf]
     │ readFile (tauri-plugin-fs)
     ▼
[Raw bytes]
     │ pdf_decrypt  ◄── lopdf (Rust)
     ▼
[Normalized + decrypted bytes]
     │                        │
     ▼                        ▼
[pdfjs render]         [pdf-lib edit]
     │                        │
     ▼                        ▼
[Canvas (Viewer +         [New bytes → pdfjs reload]
 Thumbnails +                  │
 Konva annotations)]           ▼
                         [writeFile save]
```

### Frontend

- **Chrome**
  - [index.html](index.html) · [src/main.tsx](src/main.tsx) · [src/App.tsx](src/App.tsx) · [src/App.css](src/App.css)
  - [src/components/TitleBar.tsx](src/components/TitleBar.tsx) — custom Win98 title bar (decorations off)
  - [src/components/MenuBar.tsx](src/components/MenuBar.tsx) — File / Edit / View / Tools / Help
  - [src/components/StatusBar.tsx](src/components/StatusBar.tsx) — bottom strip with state / page / zoom / filename
- **Viewer & editing**
  - [src/components/Toolbar.tsx](src/components/Toolbar.tsx) — open / save / page nav / zoom / merge / split / OCR / export / AI toggle
  - [src/components/Thumbnails.tsx](src/components/Thumbnails.tsx) — left sidebar with hover actions, right-click menu, drag-reorder
  - [src/components/Viewer.tsx](src/components/Viewer.tsx) — main page render + Konva overlay
  - [src/components/ContextMenu.tsx](src/components/ContextMenu.tsx) — shared menu component
  - [src/components/AnnotationLayer.tsx](src/components/AnnotationLayer.tsx) — Konva stage on top of the page
  - [src/components/AnnotationTools.tsx](src/components/AnnotationTools.tsx) — select / freehand / text / sticky / sign
  - [src/components/SignatureModal.tsx](src/components/SignatureModal.tsx) — draw / type / upload + saved library
  - [src/components/OcrProgressModal.tsx](src/components/OcrProgressModal.tsx)
  - [src/components/AiPanel.tsx](src/components/AiPanel.tsx) — Summary / Q&A / Extract / Redact tabs
  - [src/components/ApiKeyModal.tsx](src/components/ApiKeyModal.tsx)
- **Library**
  - [src/lib/pdf.ts](src/lib/pdf.ts) — pdfjs + pdf-lib helpers; flatten on save
  - [src/lib/store.ts](src/lib/store.ts) — zustand state + all edit actions
  - [src/lib/annotations.ts](src/lib/annotations.ts) — types + signature persistence
  - [src/lib/convert.ts](src/lib/convert.ts) — PDF↔image + PDF→text + images→PDF
  - [src/lib/ocr.ts](src/lib/ocr.ts) — Tesseract runner + pre-scan
  - [src/lib/ai.ts](src/lib/ai.ts) — Claude wrapper (summarize / ask / extract / redact)
  - [src/lib/keyboard.ts](src/lib/keyboard.ts) — global shortcuts
  - [src/lib/devtools.ts](src/lib/devtools.ts) — inspect/reload menu items

### Rust side

- [src-tauri/src/main.rs](src-tauri/src/main.rs)
- [src-tauri/src/lib.rs](src-tauri/src/lib.rs) — Tauri builder, plugin registration
- [src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) — `pdf_decrypt`, `pdf_is_encrypted`, `open_devtools`
- [src-tauri/src/ai.rs](src-tauri/src/ai.rs) — `ai_set_api_key`, `ai_get_api_key`, `ai_clear_api_key` (via `keyring`)
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)
- [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json)
- [src-tauri/.cargo/config.toml](src-tauri/.cargo/config.toml) — pinned MSVC linker on Windows

See [CLAUDE.md](CLAUDE.md) for the architecture invariants and Windows-specific
gotchas, and [PLAN.md](PLAN.md) for what's shipped vs deferred.

## Run from source

### Prerequisites (Windows)

1. Node.js 20+
2. Rust via [rustup](https://www.rust-lang.org/learn/get-started)
3. Visual Studio 2022 Build Tools with "Desktop development with C++" workload
4. Windows 11 SDK (install via the VS Installer if not already present)

### Develop

```bash
npm install
npm run tauri dev
```

First `tauri dev` compiles the Rust dependencies (including lopdf + keyring);
subsequent runs are fast.

### Build the installer yourself

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/nsis/*.exe` and `bundle/msi/*.msi`.

## Roadmap

1. ✅ Phase 1 — PDF viewer with thumbnails, open/close, zoom, paging
2. ✅ Phase 2 — Page ops (rotate, delete, insert, extract, merge, split, reorder)
3. ✅ Phase 3a — Freehand / text / sticky annotations + flatten on save
4. ✅ Phase 4 — E-signatures (draw / type / upload, resize, flatten)
5. ✅ Phase 5a — PDF ↔ images, PDF → text, images → PDF
6. ✅ Phase 6 — OCR via Tesseract with pre-scan
7. ✅ Phase 7 — AI document analysis (Claude summarize / Q&A / extract / redact)

**Deferred / nice-to-have** — see [PLAN.md](PLAN.md): text-selection highlight
layer (Phase 3b), Word/HTML → PDF (Phase 5b), multi-select thumbnails,
interactive redaction UI, code signing, auto-update.
