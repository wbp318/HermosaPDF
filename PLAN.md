# HermosaPDF — Plan & Status

Living document so future sessions can pick up where we left off without
re-reading the whole git log.

---

## Shipped — v0.1.0 ([release](https://github.com/wbp318/HermosaPDF/releases/tag/v0.1.0))

- **Phase 1** — viewer, thumbnails, zoom, paging, open/close
- **Phase 2** — rotate / delete / insert blank / extract / merge / split /
  drag-reorder; save + save-as; **stable `pageIds` labels** that follow pages
  through edits
- **Phase 3a** — freehand / text / sticky annotations via a konva overlay;
  right-click context menu; flatten-on-save
- **Phase 4** — e-signatures (draw / type / upload) with resize handles via
  konva Transformer; PNG flatten on save; library persisted in localStorage
- **Phase 5a** — PDF → images (PNG/JPEG), PDF → text (pdfjs `getTextContent`),
  images → PDF (pdf-lib). Exposed via Export ▾ dropdown
- **Phase 6** — OCR via tesseract.js with a **pre-scan** that skips pages
  already containing extractable text; invisible text layer flattened on save
- **Phase 7** — Claude-backed AI panel: Summary / Q&A / Extract / Redact
  (read-only suggestion list). Key in OS keychain via `keyring`. Prompt
  caching on document block. **Model tier selector** (Haiku → Sonnet → Opus)
- **Polish pass** — Win98 chrome (custom title bar, File/Edit/View/Tools/Help
  menu bar, sunken status bar), global keyboard shortcuts
- **Installer** — NSIS `.exe` + MSI `.msi` attached to the v0.1.0 release

---

## Phase 8 — Robust redaction (TOP PRIORITY)

**Target users:** law firms, compliance / discovery / FOIA workflows.
Goal: redaction that survives forensic recovery, not just visual overlay.
What we have today (Claude's "Redact" tab suggesting PII as a read-only
text list) is *nowhere near* this bar. Treat Phase 8 as a product
milestone, not a feature.

### 8.1 — Redaction tool (interactive)

- [ ] **Rectangle redaction** — click-drag in the viewer to draw a black
  box; list view of pending redactions per page; apply button
- [ ] **Text-selection redaction** — render the pdfjs **text layer** on
  top of the canvas so users can click-drag over actual text; redaction
  stores the word bboxes from pdfjs
- [ ] **Pattern redaction** — regex / preset rules for SSN, EIN, phone,
  email, credit-card; "Find all & mark" button. Non-destructive until
  the user applies
- [ ] **Claude-assisted** — upgrade today's Redact tab so each suggestion
  carries a bbox and an **Approve / Reject** control that converts into
  a pending redaction
- [ ] **Review panel** — side-by-side list of pending redactions (page,
  excerpt, reason, bbox); keyboard-navigable approve/reject
- [ ] **Visual polish** — applied redactions render as solid black (or
  user-chosen color) boxes, optionally stamped `[REDACTED]` with a
  reason code shown at hover

### 8.2 — Content-stream removal (the part that matters)

Visual overlay alone is not redaction — anyone with a text extractor
recovers the "hidden" text. True redaction requires removing the
underlying content-stream operators and rasterizing what's left.

- [ ] **Rust-side redaction via `pdfium-render`** — wraps Google's
  pdfium, which has first-class redaction APIs (`FPDFPage_CreateAnnot`
  with `FPDF_ANNOT_REDACT` + `FPDFPage_RedactArea`). Adds a native dep
  but gets it right.
  - Alternative: pure-Rust `lopdf` + manual content-stream parsing —
    fragile and lots of edge cases (Tj, TJ, ', ", text matrices,
    clipping, XObjects). Only if we want zero native deps.
- [ ] **Flatten + rasterize the redacted region** — re-render the
  affected page area with redaction boxes burned in, so there's no text
  underneath. pdfium handles this.
- [ ] **Verify post-redact** — re-extract text from the saved PDF and
  confirm redacted strings are absent. Unit-style: open fixture, redact,
  re-open, assert.
- [ ] **Strip text layer on OCR'd pages** — if we flattened an OCR text
  layer earlier, redaction must remove words from that layer too. Route
  redaction before OCR flattening on save.

### 8.3 — Metadata scrubbing

Every law firm requirement includes nuking metadata.

- [ ] **Document metadata** — clear `Title`, `Author`, `Subject`,
  `Keywords`, `Producer`, `CreationDate`, `ModDate` via pdf-lib.
- [ ] **XMP metadata** — strip the full `/Metadata` stream.
- [ ] **Hidden layers / OC groups** — flatten optional content so
  alternate visibility states can't leak redacted content.
- [ ] **JavaScript, embedded files, forms** — strip unless explicitly
  kept. pdfium's "remove" APIs for each, or manual pdf-lib.
- [ ] **Comments / annotations** — optional switch to strip all
  annotations on save.
- [ ] **Scrub profile presets** — "Aggressive" (strip everything),
  "Balanced" (keep annotations, strip metadata + JS), "Minimal"
  (metadata only).

### 8.4 — Audit trail + certified output

- [ ] **Redaction log** — JSON sidecar + optional final-page appendix
  listing each redaction (page, bbox, reason code, user, timestamp).
- [ ] **Bates numbering** — sequential stamps in configurable corners,
  prefix + starting number + zero-padding.
- [ ] **Certification watermark** — overlay across each page: prepared
  by, date, case number (optional, configurable).
- [ ] **Signature of the final file** — SHA-256 of the redacted bytes
  recorded in the audit log so a recipient can verify integrity.
- [ ] **Export audit bundle** — single `.zip` with: redacted.pdf,
  audit.json, audit.pdf (human-readable), sha256.txt.

### 8.5 — Batch + templates

- [ ] **Batch redaction** — pick a folder of PDFs, apply the same rule
  set across all, emit a per-file audit.
- [ ] **Saved templates** — "Standard PII", "HIPAA", "Attorney-client
  privilege". Each is a bundle of patterns + scrub profile + watermark.
- [ ] **Privilege log generator** — emit a CSV listing every document
  where privilege markers were hit.

---

## Phase 9 — Other legal-grade additions

- [ ] **Certificate-based digital signatures** — PKCS#7/CAdES sign via
  a cert from the Windows cert store. Verify signatures on open. Requires
  Rust crypto (`cryptoki` or `openssl`).
- [ ] **Form fields** — render AcroForm fields; fill and save; create new
  fields (text, checkbox, dropdown); flatten on save.
- [ ] **Bookmarks / outline** — render PDF outline; jump-nav; edit outline.
- [ ] **Document compare** — side-by-side diff of two PDFs with a
  highlighted overlay of changed regions.
- [ ] **Password protection on save** — user+owner passwords, standard
  permissions (print, copy, modify flags). pdf-lib or pdfium.
- [ ] **Secure page deletion** — guaranteed removal of the page's objects
  from the xref, not just unlinked. pdfium's linearization clean.
- [ ] **Optimize / compress** — sub-set fonts, recompress images,
  linearize. pdfium.

---

## Other planned features

- [ ] **Phase 3b — Text-selection highlight/strikethrough/underline** —
  needs the pdfjs text layer anyway (also needed for Phase 8.1), so
  ship both together.
- [ ] **Image-insertion tool** — arbitrary image annotation (not just
  signatures).
- [ ] **Phase 5b — Word / HTML / Markdown → PDF** — via `mammoth`
  (docx → HTML) + a hidden webview print-to-PDF.
- [ ] **Undo / redo** — command history on the store; pairs well with
  redaction where mistakes are costly.
- [ ] **Multi-select on thumbnails** — bulk delete / extract / rotate.
- [ ] **Custom edge resize handles** — lost when we disabled native
  decorations; implement via mouse handlers + Tauri window API.
- [ ] **Proper app icon** — replace the default scaffold icons in
  `src-tauri/icons/` with a green HermosaPDF mark.
- [ ] **Installer signing** — buy/obtain a code-signing cert so
  SmartScreen stops warning.
- [ ] **Auto-update** via `tauri-plugin-updater`, pointed at GitHub
  Releases.
- [ ] **Stamps** — classic `DRAFT` / `CONFIDENTIAL` / `APPROVED`
  overlays with custom text.
- [ ] **Page numbering / headers / footers** — add text in fixed regions
  across a range of pages.
- [ ] **Watermarks** — text or image, per page or range, with rotation
  + opacity.
- [ ] **Print** with page range + scale + booklet layout.
- [ ] **PDF/A compliance** — for long-term archival; pdfium supports.

---

## Known gotchas (all documented in CLAUDE.md + memory)

- Git Bash shadows MSVC `link.exe` — pinned in `src-tauri/.cargo/config.toml`.
- pdfjs transfers the `ArrayBuffer` to its worker — `loadPdf()` clones first
  so pdf-lib edits don't get a detached buffer.
- Tauri's window-level `dragDropEnabled` kills HTML5 drag in the webview —
  set to `false` on our window for thumbnail reorder.
- pdf-lib can't decrypt encrypted PDFs — every open is routed through
  Rust's `pdf_decrypt` (lopdf) first.
- `keyring` crate on Windows uses Credential Manager; the stored key
  survives process restart. If re-prompt happens, check the DevTools
  console for `[ai] get_api_key failed`.
- `decorations: false` means no native edge-resize; use maximize/restore
  or build custom edge handles.

---

## How to pick this up next session

1. Read `CLAUDE.md` — architecture + Windows gotchas
2. Read this file — what's shipped vs what's next
3. Read `memory/` for behavioural preferences
4. `git log --oneline -20` for recent commits
5. `npm install && npm run tauri dev` from the project root to resume

**If starting Phase 8**, first spike `pdfium-render` as a Rust dep on a
branch. Confirm a single manual redaction round-trips (load → redact a
rectangle → save → re-open → assert text absent) before building any UI.
That's the riskiest bet in the whole plan — de-risk it first.
