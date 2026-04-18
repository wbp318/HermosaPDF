# HermosaPDF

A personal PDF editing suite — a desktop app covering what Adobe Acrobat does:
text/image editing, page organization, conversion to/from PDF, e-signatures, OCR,
and AI-assisted document analysis.

> Prior Python scripts are preserved under [archive/](archive/).

## Stack

- **Tauri v2** — Rust backend, system WebView2 on Windows
- **React 19 + TypeScript + Vite** — UI
- **pdfjs-dist** — rendering
- **pdf-lib** — page manipulation
- **lopdf (Rust)** — decryption and structural normalization
- **zustand** — state management
- **tesseract.js** *(later)* — OCR
- **@anthropic-ai/sdk** *(later)* — AI features via Claude

## Architecture

Data flows left to right:

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
 Thumbnails)]                  │
                               ▼
                         [writeFile save]
```

### Frontend (React + TypeScript)

- [index.html](index.html) — Vite entry document
- [src/main.tsx](src/main.tsx) — React bootstrap with StrictMode
- [src/App.tsx](src/App.tsx) — top-level layout
- [src/App.css](src/App.css) — global styles (dark theme)

**Components**
- [src/components/Toolbar.tsx](src/components/Toolbar.tsx) — Open / Save / Save As / Close / page nav / zoom / Merge / Insert blank
- [src/components/Thumbnails.tsx](src/components/Thumbnails.tsx) — left sidebar with per-page hover actions and right-click menu
- [src/components/Viewer.tsx](src/components/Viewer.tsx) — main page render area + right-click menu
- [src/components/ContextMenu.tsx](src/components/ContextMenu.tsx) — custom context menu (dismisses on outside click / Escape)

**Library code**
- [src/lib/pdf.ts](src/lib/pdf.ts) — pdfjs + pdf-lib helpers (render, clone-on-transfer, rotate/delete/insert/merge/extract/reorder)
- [src/lib/store.ts](src/lib/store.ts) — zustand store owning doc, bytes, dirty flag, and all edit actions
- [src/lib/devtools.ts](src/lib/devtools.ts) — `invoke('open_devtools')` wrapper + shared dev menu items

### Backend (Rust, Tauri)

- [src-tauri/src/main.rs](src-tauri/src/main.rs) — binary entry
- [src-tauri/src/lib.rs](src-tauri/src/lib.rs) — Tauri builder, plugin registration, command handler
- [src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) — Tauri commands: `pdf_decrypt`, `pdf_is_encrypted`, `open_devtools`
- [src-tauri/Cargo.toml](src-tauri/Cargo.toml) — Rust crate manifest
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — window config, bundle identifier, icons
- [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) — plugin permissions (dialog, fs, core)
- [src-tauri/.cargo/config.toml](src-tauri/.cargo/config.toml) — pins MSVC linker path on Windows

### Root config

- [package.json](package.json) — npm scripts, JS deps
- [vite.config.ts](vite.config.ts) — Vite / HMR config (port 1420, ignores src-tauri)
- [tsconfig.json](tsconfig.json) — TypeScript strict mode, React JSX
- [.gitattributes](.gitattributes) — language detection, line-ending rules, vendored paths

### Encryption handling

Every opened PDF is round-tripped through [pdf_decrypt](src-tauri/src/pdfops.rs) before
the JS layer sees it. `lopdf` transparently decrypts owner-password-only PDFs (empty
password) and normalizes the structure so `pdf-lib` can edit without choking on
non-standard XRef tables. Password-protected PDFs fall through to a native prompt
in [openFromDialog](src/lib/store.ts).

## Prerequisites (Windows)

1. Node.js 20+
2. Rust via [rustup](https://www.rust-lang.org/learn/get-started)
3. Visual Studio 2022 Build Tools with the "Desktop development with C++" workload
4. Windows 11 SDK (install via the VS Installer if not already present)

## Develop

```bash
npm install
npm run tauri dev
```

The first `tauri dev` compiles the Rust dependencies (including lopdf); subsequent runs are fast.

## Build a release

```bash
npm run tauri build
```

Produces a Windows installer under `src-tauri/target/release/bundle/`.

## Roadmap

1. ✅ Phase 1 — PDF viewer with thumbnails, open/close, zoom, paging
2. Phase 2 — Page ops: rotate, delete, insert blank, extract, merge are done; reorder and split still to do
3. Phase 3 — Annotations + text/image editing
4. Phase 4 — E-signatures (draw/type/upload, place, flatten)
5. Phase 5 — File conversion (PDF ↔ images, Word/HTML → PDF)
6. Phase 6 — OCR (Tesseract, searchable-PDF output)
7. Phase 7 — AI document analysis (Claude: summarize, Q&A, extract, redact)
