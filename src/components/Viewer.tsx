import { useEffect, useRef, useState } from "react";
import { usePdfStore } from "../lib/store";
import { renderPageToCanvas } from "../lib/pdf";
import { ContextMenu, type MenuItem } from "./ContextMenu";

export function Viewer() {
  const doc = usePdfStore((s) => s.doc);
  const currentPage = usePdfStore((s) => s.currentPage);
  const zoom = usePdfStore((s) => s.zoom);
  const error = usePdfStore((s) => s.error);
  const numPages = usePdfStore((s) => s.numPages);
  const busy = usePdfStore((s) => s.busy);
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const extractPagesToFile = usePdfStore((s) => s.extractPagesToFile);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled || !canvasRef.current) return;
        await renderPageToCanvas(page, canvasRef.current, zoom * 1.5);
      } catch {
        // doc may have been destroyed mid-render — safe to ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, currentPage, zoom]);

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
    {
      label: "Rotate 90° counter-clockwise",
      onClick: () => rotatePage(pageIdx, -90),
      disabled: busy,
    },
    {
      label: "Rotate 90° clockwise",
      onClick: () => rotatePage(pageIdx, 90),
      disabled: busy,
    },
    {
      label: "Rotate 180°",
      onClick: () => rotatePage(pageIdx, 180),
      disabled: busy,
    },
    "sep",
    {
      label: "Extract this page as new PDF…",
      onClick: () => extractPagesToFile([pageIdx]),
      disabled: busy,
    },
    "sep",
    {
      label: "Delete page",
      onClick: () => deletePage(pageIdx),
      danger: true,
      disabled: busy || numPages <= 1,
    },
  ];

  return (
    <>
      <main
        className="viewer"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="page-wrap">
          <canvas ref={canvasRef} className="page-canvas" />
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
    </>
  );
}
