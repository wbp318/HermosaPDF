import { usePdfStore } from "../lib/store";

export function StatusBar() {
  const numPages = usePdfStore((s) => s.numPages);
  const currentPage = usePdfStore((s) => s.currentPage);
  const zoom = usePdfStore((s) => s.zoom);
  const filePath = usePdfStore((s) => s.filePath);
  const busy = usePdfStore((s) => s.busy);
  const loading = usePdfStore((s) => s.loading);
  const dirty = usePdfStore((s) => s.dirty);
  const annotations = usePdfStore((s) => s.annotations);
  const ocrResults = usePdfStore((s) => s.ocrResults);

  const state = loading
    ? "Opening…"
    : busy
      ? "Working…"
      : numPages === 0
        ? "Ready"
        : dirty
          ? "Modified"
          : "Ready";

  const name = filePath ? filePath.split(/[\\/]/).pop() ?? "" : "(no document)";
  const pageStr = numPages > 0 ? `Page ${currentPage} / ${numPages}` : "—";
  const zoomStr = `${Math.round(zoom * 100)}%`;

  return (
    <div className="statusbar">
      <div className="statusbar-cell grow">{state}</div>
      <div className="statusbar-cell">{pageStr}</div>
      <div className="statusbar-cell">{zoomStr}</div>
      {annotations.length > 0 && (
        <div className="statusbar-cell">{annotations.length} annotation{annotations.length === 1 ? "" : "s"}</div>
      )}
      {ocrResults.length > 0 && <div className="statusbar-cell">OCR pending</div>}
      <div className="statusbar-cell name" title={filePath ?? ""}>
        {name}
      </div>
    </div>
  );
}
