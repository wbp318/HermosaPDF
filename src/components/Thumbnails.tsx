import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { usePdfStore } from "../lib/store";
import { renderPageToCanvas } from "../lib/pdf";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { devMenuItems } from "../lib/devtools";

const THUMB_SCALE = 0.2;
const DRAG_MIME = "application/x-hermosapdf-page";

function Thumbnail({
  pageNumber,
  onRequestMenu,
}: {
  pageNumber: number;
  onRequestMenu: (pageNumber: number, x: number, y: number) => void;
}) {
  const doc = usePdfStore((s) => s.doc);
  const currentPage = usePdfStore((s) => s.currentPage);
  const numPages = usePdfStore((s) => s.numPages);
  const busy = usePdfStore((s) => s.busy);
  const setPage = usePdfStore((s) => s.setPage);
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const extractPagesToFile = usePdfStore((s) => s.extractPagesToFile);
  const movePage = usePdfStore((s) => s.movePage);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<"none" | "dragging" | "over">("none");

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        await renderPageToCanvas(page, canvasRef.current, THUMB_SCALE);
      } catch {
        // page may have been removed between render requests — ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const onDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (busy) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DRAG_MIME, String(pageNumber));
    setDragState("dragging");
  };

  const onDragEnd = () => setDragState("none");

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragState("over");
  };

  const onDragLeave = () => setDragState((s) => (s === "over" ? "none" : s));

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragState("none");
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const from = Number(raw);
    if (!from || from === pageNumber) return;
    movePage(from, pageNumber);
  };

  return (
    <div
      className={clsx(
        "thumb",
        currentPage === pageNumber && "active",
        dragState === "dragging" && "dragging",
        dragState === "over" && "drag-over",
      )}
      draggable={!busy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => setPage(pageNumber)}
      onContextMenu={(e) => {
        e.preventDefault();
        setPage(pageNumber);
        onRequestMenu(pageNumber, e.clientX, e.clientY);
      }}
    >
      <canvas ref={canvasRef} />
      <div className="thumb-label">{pageNumber}</div>
      <div className="thumb-actions" onClick={stop}>
        <button
          title="Rotate 90° counter-clockwise"
          onClick={() => rotatePage(pageNumber - 1, -90)}
          disabled={busy}
        >
          ↺
        </button>
        <button
          title="Rotate 90° clockwise"
          onClick={() => rotatePage(pageNumber - 1, 90)}
          disabled={busy}
        >
          ↻
        </button>
        <button
          title="Extract this page as a new PDF"
          onClick={() => extractPagesToFile([pageNumber - 1])}
          disabled={busy}
        >
          ⇪
        </button>
        <button
          title="Delete this page"
          className="danger"
          onClick={() => deletePage(pageNumber - 1)}
          disabled={busy || numPages <= 1}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function Thumbnails() {
  const numPages = usePdfStore((s) => s.numPages);
  const busy = usePdfStore((s) => s.busy);
  const rotatePage = usePdfStore((s) => s.rotatePage);
  const deletePage = usePdfStore((s) => s.deletePage);
  const extractPagesToFile = usePdfStore((s) => s.extractPagesToFile);

  const [menu, setMenu] = useState<{
    pageNumber: number;
    x: number;
    y: number;
  } | null>(null);

  if (numPages === 0) return null;

  const items: (MenuItem | "sep")[] = menu
    ? [
        {
          label: "Rotate 90° counter-clockwise",
          onClick: () => rotatePage(menu.pageNumber - 1, -90),
          disabled: busy,
        },
        {
          label: "Rotate 90° clockwise",
          onClick: () => rotatePage(menu.pageNumber - 1, 90),
          disabled: busy,
        },
        {
          label: "Rotate 180°",
          onClick: () => rotatePage(menu.pageNumber - 1, 180),
          disabled: busy,
        },
        "sep",
        {
          label: "Extract as new PDF…",
          onClick: () => extractPagesToFile([menu.pageNumber - 1]),
          disabled: busy,
        },
        "sep",
        {
          label: "Delete page",
          onClick: () => deletePage(menu.pageNumber - 1),
          danger: true,
          disabled: busy || numPages <= 1,
        },
        ...devMenuItems(),
      ]
    : [];

  return (
    <>
      <aside className="thumbs">
        {Array.from({ length: numPages }, (_, i) => (
          <Thumbnail
            key={i + 1}
            pageNumber={i + 1}
            onRequestMenu={(pageNumber, x, y) => setMenu({ pageNumber, x, y })}
          />
        ))}
      </aside>
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
