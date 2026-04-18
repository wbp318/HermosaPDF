# HermosaPDF — Plan & Status

Living document so future sessions can pick up where we left off without
re-reading the whole git log.

## Shipped (phases 1–7 + theme)

- **Phase 1** — viewer, thumbnails, zoom, paging, open/close
- **Phase 2** — rotate / delete / insert blank / extract / merge / split /
  drag-reorder; save + save-as; **stable `pageIds` labels** that follow pages
  through edits
- **Phase 3** — freehand / text / sticky annotations via a konva overlay;
  right-click context menu; flatten-on-save
- **Phase 4** — e-signatures (draw / type / upload) with resize handles via
  konva Transformer; PNG flatten on save; library persisted in localStorage
- **Phase 5a** — PDF → images (PNG/JPEG), PDF → text (pdfjs `getTextContent`),
  images → PDF (pdf-lib). Exposed via Export ▾ dropdown
- **Phase 6** — OCR via tesseract.js with a **pre-scan** that skips pages
  already containing extractable text; invisible text layer flattened on save
- **Phase 7** — Claude-backed AI panel: Summary / Q&A / Extract / Redact.
  Key lives in the OS keychain via Rust `keyring`. Prompt caching on the
  document block. **Model tier selector** (default Haiku 4.5 →
  Sonnet 4.6 → Opus 4.7)
- **Win98 skin** — gray beveled chrome + phosphor-green accents, Tahoma
  fonts, inset sunken inputs, chunky 16px scrollbars, teal desktop peek

## In progress (this session)

- **Custom title bar** — `decorations: false`; green gradient titlebar with
  min/max/close buttons (see `src/components/TitleBar.tsx`). Drag via
  `data-tauri-drag-region`. Note: native resize handles are gone — user
  resizes via maximize/restore. Manual edge-resize handlers could be added
  later if someone really wants windowed resize back.
- **Menu bar** — File / Edit / View / Tools / Help (`src/components/MenuBar.tsx`).
  Reuses `ContextMenu` for dropdowns. Items mirror the toolbar + thumbnail
  context menu, with `Ctrl+…` accelerator hints in each label.
- **Status bar** — bottom strip with state / page / zoom / annotations /
  OCR-pending / filename (`src/components/StatusBar.tsx`).
- **Global keyboard shortcuts** (`src/lib/keyboard.ts`): `Ctrl+O`, `Ctrl+S`,
  `Ctrl+Shift+S`, `Ctrl+W`, `Ctrl+±/0`, `←/→` for paging, `V`/`P`/`T` for
  tools, `Del` for selected annotation.
- **Build the `.exe` installer** — next step after the above ship clean.
  Run `npm run tauri build`; output under
  `src-tauri/target/release/bundle/`. First-time release compile is slow
  (~10–20 min) because of `lopdf` + `tauri-runtime-wry`.

## Deferred / nice-to-have

- **Phase 3b** — text-selection-based highlight/strikethrough/underline.
  Requires adding pdfjs's text layer over the canvas and mapping selections
  back to PDF coordinates. Non-trivial; deferred.
- **Image-insertion tool** — arbitrary image annotation (not just signatures).
- **Phase 5b** — Word (.docx) → PDF via `mammoth` → HTML → headless render.
  Also Markdown/HTML → PDF.
- **Undo/redo** across page ops + annotations. Would need a command history.
- **Multi-select** on thumbnails for bulk delete/extract/rotate.
- **Redact UI** — convert AI redact suggestions into actual black rectangles
  the user can approve. Today they're a read-only text list.
- **Custom edge resize handles** — lost when we disabled native decorations.
- **Proper app icon** — replace the default scaffold icons in
  `src-tauri/icons/` with a green HermosaPDF mark.
- **Installer signing** — otherwise Windows SmartScreen warns on install.
- **Auto-update** via `tauri-plugin-updater`.

## Known gotchas (all documented in CLAUDE.md + memory)

- Git Bash shadows MSVC `link.exe` — pinned in `src-tauri/.cargo/config.toml`.
- pdfjs transfers the `ArrayBuffer` to its worker — `loadPdf()` clones first
  so pdf-lib edits don't get a detached buffer.
- Tauri's window-level `dragDropEnabled` kills HTML5 drag in the webview —
  set to `false` on our window for thumbnail reorder.
- pdf-lib can't decrypt encrypted PDFs — every open is routed through Rust's
  `pdf_decrypt` (lopdf) first.
- `keyring` crate on Windows uses Credential Manager; the stored key
  survives process restart. If re-prompt happens, check the DevTools
  console for `[ai] get_api_key failed`.

## How to pick this up next session

1. Read `CLAUDE.md` — architecture + Windows gotchas
2. Read this file — what's shipped vs what's next
3. Read `memory/` for behavioural preferences
4. `git log --oneline -20` for recent commits
5. `npm install && npm run tauri dev` from the project root to resume
