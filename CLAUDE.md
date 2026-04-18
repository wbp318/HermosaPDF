# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                       # install JS deps
npm run tauri dev                                 # dev: Vite on :1420 + cargo run, opens native window
npm run tauri build                               # release build + NSIS/MSI installer under src-tauri/target/release/bundle/
npm run dev                                       # Vite-only (page will error — no Tauri IPC)
npm run build                                     # tsc --noEmit + vite build
npx tsc --noEmit                                  # type-check only
node scripts/generate-test-agreement.mjs          # regenerate test-fixtures/agreement.pdf
```

The first `tauri dev` compiles ~400 Rust crates (~2 min). After that, edits to `src-tauri/**` trigger a ~15s rebuild + window relaunch; frontend edits hit via Vite HMR with no rebuild. First release build (`tauri build`) takes 10–20 min — downloads WiX + NSIS on first run.

No test runner is wired up. Type-check (`npx tsc --noEmit`) and the running dev UI are the feedback loops.

## Architecture — what requires reading multiple files

### Data flow: every PDF goes through Rust first

```
disk → readFile → pdf_decrypt (lopdf, Rust) → normalized bytes
                                                    │
                                        ┌───────────┼──────────────┐
                                        ▼                          ▼
                                  pdfjs (render)            pdf-lib (edit)
```

**Never hand raw `readFile` bytes to pdfjs or pdf-lib directly.** Always call `normalizePdfBytes()` in [src/lib/store.ts](src/lib/store.ts) first — it invokes the `pdf_decrypt` Tauri command ([src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs), backed by `lopdf`). That's the only reliable way to edit owner-password-encrypted PDFs; pdf-lib cannot decrypt, and loading with `ignoreEncryption: true` produces malformed saves that pdfjs then rejects with "No password given".

The password prompt loop lives in the store's `openFromDialog` — Rust returns `"decrypt: password required"` and the frontend re-invokes with the user-entered password.

### The store owns everything

Single zustand store at [src/lib/store.ts](src/lib/store.ts). It holds:
- Doc state: `doc` (PDFDocumentProxy), `bytes` (decrypted PDF), `filePath`, `numPages`, `currentPage`, `zoom`
- **`pageIds: number[]`** — stable identity per current page slot (see below)
- Annotations: `annotations[]`, `tool`, `selectedAnnotationId`, color, stroke width, signatures library
- OCR: `ocrResults`, `ocrProgress`, `ocrSkippedPages`
- AI: `aiPanelOpen`, `aiModel`
- Flags: `dirty`, `busy`, `loading`, `error`, `notice`

Every edit action:
1. Calls a pure `fooBytes()` helper in [src/lib/pdf.ts](src/lib/pdf.ts) that returns new bytes via pdf-lib
2. Calls `reloadDoc(prev, nextBytes)` — loads the new pdfjs doc first, then destroys the previous one (order matters; destroying early orphans in-flight `getPage` promises and produces `Cannot read properties of null (reading 'sendWithPromise')` in Viewer async renders)
3. Updates `bytes`, `doc`, `numPages`, `pageIds`, `dirty`

Components pick narrow slices via `usePdfStore(s => s.foo)` — don't pull the whole state.

### `pageIds` is load-bearing

`pageIds` maps each current page position (1-indexed) to a stable number that follows the page through reorders/deletes/inserts/merges. Annotations and OCR results key on `pageId`, not on position, so they stay with their page. Every action that mutates the page list must also mutate `pageIds`:

- `reorderPages(newOrder)` — permutes `pageIds` by the same order
- `deletePage(idx)` — splices entry out
- `insertBlankAt(idx)` — inserts `max(pageIds) + 1` at that slot
- `mergeFromDialog()` — appends fresh IDs `max+1..max+K`
- `movePage(from, to)` — splice-then-insert (the obvious loop-based "insert-before-target" is a no-op when dragging down)

Thumbnails render `pageIds[pageNumber - 1]` as their label.

### Annotation coordinates + Konva overlay

Annotations are stored in **pdfjs top-left PDF-point coordinates**. The Konva overlay in [src/components/AnnotationLayer.tsx](src/components/AnnotationLayer.tsx) scales by `zoom * 1.5` (matches the canvas render). When flattening in [`flattenAnnotations`](src/lib/pdf.ts), y is flipped to pdf-lib's bottom-left origin (`pageHeight - y`). Freehand → SVG path; text → `drawText`; sticky → `drawCircle` + `drawText`; signatures → `embedPng` + `drawImage`.

Save clears in-memory annotations after flattening — they now live in the bytes.

### Chrome: custom title bar + menu bar + status bar

`tauri.conf.json` has `"decorations": false` + `"dragDropEnabled": false`. The UI is:

```
[TitleBar]       ← custom, green gradient, data-tauri-drag-region
[MenuBar]        ← File/Edit/View/Tools/Help via ContextMenu dropdowns
[Toolbar]        ← open/save/page-nav/zoom/merge/split/OCR/export/AI
[Thumbnails | Viewer+AnnotationLayer | AiPanel]
[StatusBar]
[OcrProgressModal]
```

**Tradeoff:** native Windows edge resize is disabled. Resize via maximize/restore. Moving requires `data-tauri-drag-region` on the title bar divs.

Global keyboard shortcuts live in [src/lib/keyboard.ts](src/lib/keyboard.ts) — Ctrl+O/S/Shift-S/W, Ctrl+±/0, ←/→, V/P/T tool hotkeys, Del for selected annotation. Suppressed when an input or textarea has focus.

### AI integration

Frontend uses `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. Model is tier-selected: `claude-haiku-4-5` (default) → `claude-sonnet-4-6` → `claude-opus-4-7`. **Adaptive thinking is Sonnet/Opus only** — Haiku 4.5 400s on `thinking`/`effort`, so [src/lib/ai.ts](src/lib/ai.ts) gates it via `thinkingFor(tier)`.

The document text goes in a system-block with `cache_control: { type: "ephemeral" }` — repeat calls (Q&A chains, re-runs) hit Anthropic's prompt cache and pay ~0.1× on cached input.

API key lives in the OS keychain, not the app. [src-tauri/src/ai.rs](src-tauri/src/ai.rs) uses the `keyring` crate (Windows Credential Manager backend) and exposes `ai_set_api_key`, `ai_get_api_key`, `ai_clear_api_key`. The frontend invokes these via `@tauri-apps/api/core`; the key string never touches disk or git.

### Rust side is small on purpose

[src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) + [src-tauri/src/ai.rs](src-tauri/src/ai.rs). New Rust commands go in one of those (or a new module) and get registered in [lib.rs](src-tauri/src/lib.rs)'s `invoke_handler`. Prefer Rust for CPU-heavy or credential-sensitive work.

## Windows-specific gotchas (worked around in config)

- **Git Bash shadows MSVC `link.exe`** via `/usr/bin/link.exe`. [src-tauri/.cargo/config.toml](src-tauri/.cargo/config.toml) pins the absolute path to MSVC's linker. Update if the MSVC component version changes (check `C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC`).
- **pdfjs transfers the `ArrayBuffer`** to its worker, detaching the caller's `Uint8Array`. `loadPdf()` clones with `Uint8Array.from(bytes)` before handing to `pdfjs.getDocument`. Don't remove that clone. Any new code that feeds bytes to pdfjs must do the same.
- **Tauri's window drag-drop handler kills HTML5 drag** inside the webview by default. `tauri.conf.json` sets `dragDropEnabled: false` — required for the thumbnail reorder. Trade-off: OS-level file drops onto the window no longer fire a Tauri event; handle them with HTML5 listeners in the webview if needed.
- **`cargo run` piped through `tail`** masks failures — the pipe's exit code is `tail`'s. If a build looks clean via `tail -n`, read the full output when something seems off.
- **`cargo` needs `~/.cargo/bin` on PATH** in Git Bash sessions (rustup's installer only edits system PATH for new shells). Export it inline or the `tauri dev` subshell will say `program not found`.

## Where things live

- Renderer helpers and pdf-lib edit ops: [src/lib/pdf.ts](src/lib/pdf.ts)
- Store + all actions: [src/lib/store.ts](src/lib/store.ts)
- Annotation types + signature persistence: [src/lib/annotations.ts](src/lib/annotations.ts)
- Conversion (PDF↔images, PDF→text, images→PDF): [src/lib/convert.ts](src/lib/convert.ts)
- OCR runner: [src/lib/ocr.ts](src/lib/ocr.ts)
- Claude wrapper (summarize / ask / extract / redact): [src/lib/ai.ts](src/lib/ai.ts)
- Global keyboard shortcuts: [src/lib/keyboard.ts](src/lib/keyboard.ts)
- Tauri commands: [src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) · [src-tauri/src/ai.rs](src-tauri/src/ai.rs) · [src-tauri/src/lib.rs](src-tauri/src/lib.rs)
- Capabilities / permissions: [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json)
- Test PDF: [test-fixtures/agreement.pdf](test-fixtures/agreement.pdf) (regen via `scripts/generate-test-agreement.mjs`)
- Prior Python work: [archive/](archive/) — reference only; do not revive
- Session-to-session plan: [PLAN.md](PLAN.md)

## Roadmap status

All seven phases shipped and tagged as [v0.1.0](https://github.com/wbp318/HermosaPDF/releases/tag/v0.1.0) — viewer, page ops, annotations, e-signatures, conversion, OCR, Claude AI — plus the custom Win98 chrome pass. See [PLAN.md](PLAN.md) for what's next (text-selection highlight, Word→PDF, multi-select thumbnails, redaction UI, code signing, auto-update).
