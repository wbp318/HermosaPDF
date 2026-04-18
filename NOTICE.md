# Third-Party Notices

HermosaPDF incorporates the following open-source software components.
These components are licensed to you by their respective authors under
their respective licenses, not under HermosaPDF’s proprietary license.
A copy of each license is reproduced in each component’s repository or
within the component’s distribution files.

© 2026 Levee Line Research LLC. The HermosaPDF application as a whole is
licensed under `LICENSE.md`. This file acknowledges the open-source
libraries HermosaPDF depends on.

## JavaScript / TypeScript runtime dependencies

| Package | License | Source |
|---|---|---|
| `react` / `react-dom` | MIT | https://github.com/facebook/react |
| `@tauri-apps/api` / `@tauri-apps/plugin-dialog` / `@tauri-apps/plugin-fs` | MIT or Apache-2.0 | https://github.com/tauri-apps/tauri |
| `pdfjs-dist` | Apache-2.0 | https://github.com/mozilla/pdf.js |
| `pdf-lib` | MIT | https://github.com/Hopding/pdf-lib |
| `konva` / `react-konva` | MIT | https://github.com/konvajs/konva |
| `tesseract.js` | Apache-2.0 | https://github.com/naptha/tesseract.js |
| `@anthropic-ai/sdk` | MIT | https://github.com/anthropics/anthropic-sdk-typescript |
| `zustand` | MIT | https://github.com/pmndrs/zustand |
| `clsx` | MIT | https://github.com/lukeed/clsx |

## Build-time dependencies

| Package | License | Source |
|---|---|---|
| `vite` | MIT | https://github.com/vitejs/vite |
| `typescript` | Apache-2.0 | https://github.com/microsoft/TypeScript |
| `@vitejs/plugin-react` | MIT | https://github.com/vitejs/vite-plugin-react |

## Rust dependencies (Tauri backend)

| Crate | License | Source |
|---|---|---|
| `tauri` / `tauri-build` / `tauri-plugin-dialog` / `tauri-plugin-fs` | MIT or Apache-2.0 | https://github.com/tauri-apps/tauri |
| `lopdf` | MIT | https://github.com/J-F-Liu/lopdf |
| `keyring` | MIT or Apache-2.0 | https://github.com/hwchen/keyring-rs |
| `serde` / `serde_json` | MIT or Apache-2.0 | https://serde.rs |

Rust transitive dependencies are catalogued in
`src-tauri/Cargo.lock`. Each crate’s license is available in its
source repository and in the locally cached registry copy at
`~/.cargo/registry/src/…/<crate>-<version>/LICENSE` after a build.

## Fonts and assets at runtime

At signature-creation time, the application loads the Google Fonts
“Dancing Script,” “Caveat,” and “Great Vibes” families by HTTPS
request to `fonts.googleapis.com`. Those fonts are licensed under the
SIL Open Font License, Version 1.1.

## Trained OCR data

The English-language Tesseract trained data (`eng.traineddata`) is
downloaded at first OCR invocation from `jsdelivr.net` and is licensed
under the Apache License 2.0 by Google Inc. and Ray Smith.

---

**Providing this file satisfies the attribution requirements of each
component’s license. If you redistribute HermosaPDF, you must continue
to include this file with the distribution.**
