# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                                       # install JS deps
npm run tauri dev                                 # dev: Vite on :1420 + cargo run, opens native window
npm run tauri build                               # production installer under src-tauri/target/release/bundle/
npm run dev                                       # Vite-only (page will error — no Tauri IPC)
npm run build                                     # tsc --noEmit + vite build
npx tsc --noEmit                                  # type-check only
node scripts/generate-test-agreement.mjs          # regenerate test-fixtures/agreement.pdf
```

The first `tauri dev` compiles ~400 Rust crates (~2 min). After that, edits to `src-tauri/**` trigger a ~15s rebuild + window relaunch; frontend edits hit via Vite HMR with no rebuild.

There is no test runner wired up — type-check and the running dev UI are the feedback loops.

## Architecture

### Data flow — always goes through Rust first

```
disk → readFile → pdf_decrypt (lopdf, Rust) → normalized bytes
                                                    │
                                        ┌───────────┼──────────────┐
                                        ▼                          ▼
                                  pdfjs (render)            pdf-lib (edit)
```

Do **not** hand raw `readFile` bytes to pdfjs or pdf-lib directly. Always call `normalizePdfBytes()` in [src/lib/store.ts](src/lib/store.ts) first — it invokes the `pdf_decrypt` Tauri command which round-trips every PDF through `lopdf`. That's the only reliable way to edit owner-password-encrypted PDFs (pdf-lib cannot decrypt; `ignoreEncryption: true` produces malformed saves that pdfjs then rejects with "No password given").

If a PDF needs a real password, the store's `openFromDialog` loops on `window.prompt` and re-invokes `pdf_decrypt` with the entry.

### The store is the brain

Single zustand store at [src/lib/store.ts](src/lib/store.ts) owns:
- `doc` (PDFDocumentProxy from pdfjs), `bytes` (decrypted PDF), `filePath`
- `pageIds: number[]` — stable identity per current page slot
- `annotations[]`, `tool`, `selectedAnnotationId`, color, stroke width
- `dirty`, `busy`, `error`

Every edit action:
1. Calls a pure `fooBytes()` helper in [src/lib/pdf.ts](src/lib/pdf.ts) that returns new bytes via pdf-lib
2. Calls `reloadDoc(prev, nextBytes)` — loads the new pdfjs doc first, then destroys the previous one (order matters; destroying early orphans in-flight `getPage` promises)
3. Updates `bytes`, `doc`, `numPages`, `pageIds`, `dirty`

Components pick narrow slices via `usePdfStore(s => s.foo)` — don't pull the whole state.

### pageIds is load-bearing

`pageIds` maps each current page position (1-indexed) to a stable number that follows the page through reorders/deletes/inserts/merges. Annotations key on `pageId`, not on position, so they stay with their page. Every action that mutates the page list must also mutate `pageIds`:

- `reorderPages(newOrder)` — permutes `pageIds` by the same order
- `deletePage(idx)` — splices entry out
- `insertBlankAt(idx)` — inserts `max(pageIds) + 1` at that slot
- `mergeFromDialog()` — appends fresh IDs `max+1..max+K`
- `movePage(from, to)` — uses splice-then-insert (the obvious loop-based "insert-before-target" is a no-op when dragging down)

Thumbnails render `pageIds[pageNumber - 1]` as their label so a page's identity is visible after moves.

### Annotation coordinates

Annotations are stored in **pdfjs top-left PDF-point coordinates**. The Konva overlay scales by `zoom * 1.5` (matches the canvas render). When flattening in [flattenAnnotations](src/lib/pdf.ts), y is flipped to pdf-lib's bottom-left origin (`pageHeight - y`). Freehand strokes are emitted as SVG paths via `page.drawSvgPath`; text via `drawText`; sticky via `drawCircle` + `drawText`.

Save clears the in-memory annotations after flattening — they now live in the bytes.

### Rust side is small on purpose

[src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) exposes three commands: `pdf_decrypt`, `pdf_is_encrypted`, `open_devtools`. New Rust commands go here and get registered in [lib.rs](src-tauri/src/lib.rs)'s `invoke_handler`. Prefer Rust for CPU-heavy or encryption-sensitive work; keep React focused on UX.

If a PDF still fails after `lopdf`, the next escalation is `pdfium-render` (Google pdfium bindings — handles more edge cases but adds a C++ runtime dependency).

## Windows-specific gotchas (all already worked around in config)

- **Git Bash shadows MSVC `link.exe`** via `/usr/bin/link.exe` (GNU coreutils). [src-tauri/.cargo/config.toml](src-tauri/.cargo/config.toml) pins the absolute path to MSVC's linker. Update it if the MSVC component version changes (check `C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC`).
- **pdfjs transfers the ArrayBuffer** to its worker, detaching the caller's `Uint8Array`. `loadPdf()` clones with `Uint8Array.from(bytes)` before handing to `pdfjs.getDocument`. Do not remove that clone. Any *new* code that feeds bytes to pdfjs must do the same.
- **Tauri's window drag-drop handler kills HTML5 drag** inside the webview by default. [tauri.conf.json](src-tauri/tauri.conf.json) sets `dragDropEnabled: false` on the window, which is required for the thumbnail reorder. Trade-off: OS-level file drops onto the window no longer fire a Tauri event; handle file drops with HTML5 listeners in the webview if needed.
- **`cargo run` piped through `tail`** masks failures — the pipe's exit code is `tail`'s. If a build looks clean via `tail -n`, read the full output when something seems off.
- **`cargo` needs `~/.cargo/bin` on PATH** in Git Bash sessions (rustup's installer only edits the system PATH for new shells). Export it inline or the `tauri dev` subshell will say `program not found`.

## Where things live

- Renderer helpers and pdf-lib edit ops: [src/lib/pdf.ts](src/lib/pdf.ts)
- Store + all actions: [src/lib/store.ts](src/lib/store.ts)
- Annotation types + default colors: [src/lib/annotations.ts](src/lib/annotations.ts)
- Dev menu items (Inspect / Reload): [src/lib/devtools.ts](src/lib/devtools.ts)
- Tauri commands: [src-tauri/src/pdfops.rs](src-tauri/src/pdfops.rs) + [src-tauri/src/lib.rs](src-tauri/src/lib.rs)
- Capabilities / permissions: [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json)
- Test PDF: [test-fixtures/agreement.pdf](test-fixtures/agreement.pdf) (regen via `scripts/generate-test-agreement.mjs`)
- Prior Python work: [archive/](archive/) — reference only; do not revive

## Roadmap status

Phases 1–2 complete (viewer, page ops). Phase 3a complete (freehand / text / sticky annotations with flatten-on-save). Next: text-selection highlight (needs pdfjs text layer), image insertion, then Phase 4 e-signatures. Phases 5 (conversion), 6 (OCR), 7 (Claude) pending.
