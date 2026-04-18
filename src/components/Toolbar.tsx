import { useRef, useState } from "react";
import { usePdfStore } from "../lib/store";
import { ContextMenu, type MenuItem } from "./ContextMenu";

export function Toolbar() {
  const {
    filePath,
    numPages,
    currentPage,
    zoom,
    loading,
    busy,
    dirty,
    openFromDialog,
    setPage,
    setZoom,
    close,
    save,
    saveAs,
    mergeFromDialog,
    insertBlankAt,
    splitAt,
    exportImages,
    exportText,
    imagesToPdfDialog,
    runOcr,
    ocrResults,
    clearOcr,
    notice,
    dismissNotice,
  } = usePdfStore();

  const exportBtnRef = useRef<HTMLButtonElement | null>(null);
  const [exportMenu, setExportMenu] = useState<{ x: number; y: number } | null>(null);

  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;
  const hasDoc = numPages > 0;

  const openExportMenu = () => {
    const rect = exportBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setExportMenu({ x: rect.left, y: rect.bottom + 4 });
  };

  const exportItems: (MenuItem | "sep")[] = [
    {
      label: "Export pages as PNG…",
      onClick: () => exportImages("png"),
      disabled: busy || !hasDoc,
    },
    {
      label: "Export pages as JPEG…",
      onClick: () => exportImages("jpeg"),
      disabled: busy || !hasDoc,
    },
    {
      label: "Export text…",
      onClick: () => exportText(),
      disabled: busy || !hasDoc,
    },
    "sep",
    {
      label: "Create PDF from images…",
      onClick: () => imagesToPdfDialog(),
      disabled: busy,
    },
  ];

  const onSplit = () => {
    const input = window.prompt(
      `Split after which page? (1–${numPages - 1})`,
      String(Math.max(1, Math.floor(numPages / 2))),
    );
    if (!input) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 1 || n >= numPages) {
      window.alert(`Invalid split point. Must be between 1 and ${numPages - 1}.`);
      return;
    }
    splitAt(n);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button onClick={openFromDialog} disabled={loading || busy}>
          {loading ? "Opening…" : "Open"}
        </button>
        {hasDoc && (
          <>
            <button onClick={save} disabled={busy || !dirty}>
              Save
            </button>
            <button onClick={saveAs} disabled={busy}>
              Save As…
            </button>
            <button onClick={close} className="ghost" disabled={busy}>
              Close
            </button>
          </>
        )}
      </div>

      {hasDoc && (
        <>
          <div className="toolbar-group">
            <button onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
              ◀
            </button>
            <input
              type="number"
              value={currentPage}
              min={1}
              max={numPages}
              onChange={(e) => setPage(Number(e.target.value))}
            />
            <span className="muted">/ {numPages}</span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= numPages}
            >
              ▶
            </button>
          </div>

          <div className="toolbar-group">
            <button onClick={() => setZoom(zoom - 0.25)}>−</button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(zoom + 0.25)}>+</button>
            <button className="ghost" onClick={() => setZoom(1)}>
              Fit
            </button>
          </div>

          <div className="toolbar-group">
            <button
              onClick={() => insertBlankAt(currentPage)}
              disabled={busy}
              title="Insert blank page after current"
            >
              + Blank page
            </button>
            <button onClick={mergeFromDialog} disabled={busy} title="Append another PDF">
              Merge…
            </button>
            <button
              onClick={onSplit}
              disabled={busy || numPages < 2}
              title="Split into two PDFs at a chosen page"
            >
              Split…
            </button>
          </div>
        </>
      )}

      <div className="toolbar-group">
        {hasDoc && (
          <button
            onClick={ocrResults.length > 0 ? clearOcr : runOcr}
            disabled={busy}
            title={
              ocrResults.length > 0
                ? "Remove pending OCR text layer"
                : "Run OCR to make this PDF searchable"
            }
            className={ocrResults.length > 0 ? "active" : undefined}
          >
            {ocrResults.length > 0 ? "OCR ✓" : "OCR"}
          </button>
        )}
        <button
          ref={exportBtnRef}
          onClick={openExportMenu}
          disabled={busy}
          title="Convert / export"
        >
          Export ▾
        </button>
      </div>

      <div className="toolbar-group right">
        {dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
        {fileName && <span className="filename">{fileName}</span>}
      </div>

      {exportMenu && (
        <ContextMenu
          x={exportMenu.x}
          y={exportMenu.y}
          items={exportItems}
          onClose={() => setExportMenu(null)}
        />
      )}
      {notice && (
        <div className="toolbar-notice" onClick={dismissNotice} title="Click to dismiss">
          {notice}
        </div>
      )}
    </header>
  );
}
