import { useEffect, useRef, useState } from "react";
import { usePdfStore } from "../lib/store";
import { renderPageToCanvas } from "../lib/pdf";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { devMenuItems } from "../lib/devtools";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationTools } from "./AnnotationTools";

export function Viewer() {
  const doc = usePdfStore((s) => s.doc);
  const currentPage = usePdfStore((s) => s.currentPage);
  const zoom = usePdfStore((s) => s.zoom);
  const error = usePdfStore((s) => s.error);
  const numPages = usePdfStore((s) => s.numPages);
  const busy = usePdfStore((s) => s.busy);
  const pageIds = usePdfStore((s) => s.pageIds);
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const extractPagesToFile = usePdfStore((s) => s.extractPagesToFile);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const screenScale = zoom * 1.5;

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled || !canvasRef.current) return;
        const base = page.getViewport({ scale: 1 });
        setPageSize({ width: base.width, height: base.height });
        await renderPageToCanvas(page, canvasRef.current, screenScale);
      } catch {
        // doc may have been destroyed mid-render — safe to ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, currentPage, screenScale]);

  if (error) {
    return (
      <div className="viewer empty">
        <div className="empty-state error">
          <h2>Couldn't open PDF</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="viewer empty">
        <div className="empty-state">
          <h1>HermosaPDF</h1>
          <p>Open a PDF to get started.</p>
        </div>
      </div>
    );
  }

  const pageIdx = currentPage - 1;
  const items: (MenuItem | "sep")[] = [
    { label: "Rotate 90° counter-clockwise", onClick: () => rotatePage(pageIdx, -90), disabled: busy },
    { label: "Rotate 90° clockwise", onClick: () => rotatePage(pageIdx, 90), disabled: busy },
    { label: "Rotate 180°", onClick: () => rotatePage(pageIdx, 180), disabled: busy },
    "sep",
    { label: "Extract this page as new PDF…", onClick: () => extractPagesToFile([pageIdx]), disabled: busy },
    "sep",
    { label: "Delete page", onClick: () => deletePage(pageIdx), danger: true, disabled: busy || numPages <= 1 },
    ...devMenuItems(),
  ];

  const pageId = pageIds[pageIdx] ?? currentPage;

  return (
    <div className="viewer-wrap">
      <AnnotationTools />
      <main
        className="viewer"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="page-wrap" style={{ position: "relative" }}>
          <canvas ref={canvasRef} className="page-canvas" />
          {pageSize && (
            <AnnotationLayer
              pageId={pageId}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
              screenScale={screenScale}
            />
          )}
        </div>
      </main>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={items}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
