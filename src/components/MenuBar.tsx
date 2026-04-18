import { useRef, useState } from "react";
import clsx from "clsx";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePdfStore } from "../lib/store";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { openDevtools } from "../lib/devtools";

interface TopMenu {
  id: string;
  label: string;
  accel: string;
  items: (MenuItem | "sep")[];
}

export function MenuBar() {
  const {
    numPages,
    currentPage,
    dirty,
    busy,
    zoom,
    openFromDialog,
    close,
    save,
    saveAs,
    setZoom,
    insertBlankAt,
    mergeFromDialog,
    splitAt,
    rotatePage,
    deletePage,
    extractPagesToFile,
    runOcr,
    exportImages,
    exportText,
    imagesToPdfDialog,
    toggleAiPanel,
    selectedAnnotationId,
    removeAnnotation,
    setTool,
  } = usePdfStore();

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const buttonsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const hasDoc = numPages > 0;
  const pageIdx = currentPage - 1;

  const onSplitPrompt = () => {
    const input = window.prompt(
      `Split after which page? (1–${numPages - 1})`,
      String(Math.max(1, Math.floor(numPages / 2))),
    );
    if (!input) return;
    const n = Number(input);
    if (!Number.isFinite(n) || n < 1 || n >= numPages) return;
    splitAt(n);
  };

  const openAbout = () => {
    window.alert(
      "HermosaPDF\nVersion 0.1.0\n\nPersonal PDF editing suite.\nBuilt with Tauri v2, React, and pdf-lib.",
    );
  };

  const menus: TopMenu[] = [
    {
      id: "file",
      label: "File",
      accel: "F",
      items: [
        { label: "Open…\tCtrl+O", onClick: openFromDialog, disabled: busy },
        { label: "Save\tCtrl+S", onClick: save, disabled: busy || !dirty || !hasDoc },
        { label: "Save As…\tCtrl+Shift+S", onClick: saveAs, disabled: busy || !hasDoc },
        { label: "Close\tCtrl+W", onClick: close, disabled: busy || !hasDoc },
        "sep",
        {
          label: "Exit\tAlt+F4",
          onClick: () => getCurrentWindow().close(),
        },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      accel: "E",
      items: [
        { label: "Select tool (V)", onClick: () => setTool("select") },
        { label: "Freehand (P)", onClick: () => setTool("freehand") },
        { label: "Text (T)", onClick: () => setTool("text") },
        { label: "Sticky (S)", onClick: () => setTool("sticky") },
        "sep",
        {
          label: "Delete selected\tDel",
          onClick: () => selectedAnnotationId && removeAnnotation(selectedAnnotationId),
          disabled: !selectedAnnotationId,
          danger: true,
        },
      ],
    },
    {
      id: "view",
      label: "View",
      accel: "V",
      items: [
        { label: "Zoom in\tCtrl++", onClick: () => setZoom(zoom + 0.25) },
        { label: "Zoom out\tCtrl+-", onClick: () => setZoom(zoom - 0.25) },
        { label: "Actual size\tCtrl+0", onClick: () => setZoom(1) },
        "sep",
        { label: "Toggle AI panel", onClick: toggleAiPanel },
      ],
    },
    {
      id: "tools",
      label: "Tools",
      accel: "T",
      items: [
        {
          label: "Rotate page 90° CW",
          onClick: () => rotatePage(pageIdx, 90),
          disabled: !hasDoc || busy,
        },
        {
          label: "Rotate page 90° CCW",
          onClick: () => rotatePage(pageIdx, -90),
          disabled: !hasDoc || busy,
        },
        {
          label: "Insert blank page",
          onClick: () => insertBlankAt(currentPage),
          disabled: !hasDoc || busy,
        },
        {
          label: "Extract current page…",
          onClick: () => extractPagesToFile([pageIdx]),
          disabled: !hasDoc || busy,
        },
        {
          label: "Delete current page",
          onClick: () => deletePage(pageIdx),
          disabled: !hasDoc || busy || numPages <= 1,
          danger: true,
        },
        "sep",
        { label: "Merge with another PDF…", onClick: mergeFromDialog, disabled: !hasDoc || busy },
        { label: "Split PDF…", onClick: onSplitPrompt, disabled: !hasDoc || busy || numPages < 2 },
        "sep",
        {
          label: "Run OCR (make searchable)",
          onClick: runOcr,
          disabled: !hasDoc || busy,
        },
        "sep",
        {
          label: "Export pages as PNG…",
          onClick: () => exportImages("png"),
          disabled: !hasDoc || busy,
        },
        {
          label: "Export pages as JPEG…",
          onClick: () => exportImages("jpeg"),
          disabled: !hasDoc || busy,
        },
        {
          label: "Export text…",
          onClick: exportText,
          disabled: !hasDoc || busy,
        },
        {
          label: "Create PDF from images…",
          onClick: imagesToPdfDialog,
          disabled: busy,
        },
      ],
    },
    {
      id: "help",
      label: "Help",
      accel: "H",
      items: [
        { label: "Inspect element", onClick: () => void openDevtools() },
        { label: "Reload", onClick: () => location.reload() },
        "sep",
        { label: "About HermosaPDF…", onClick: openAbout },
      ],
    },
  ];

  const openAt = (id: string) => {
    const btn = buttonsRef.current.get(id);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setOpenMenu(id);
    setMenuPos({ x: rect.left, y: rect.bottom });
  };

  const current = openMenu ? menus.find((m) => m.id === openMenu) ?? null : null;

  return (
    <div className="menubar">
      {menus.map((m) => (
        <button
          key={m.id}
          ref={(el) => {
            if (el) buttonsRef.current.set(m.id, el);
          }}
          className={clsx("menubar-btn", openMenu === m.id && "active")}
          onMouseDown={(e) => {
            e.preventDefault();
            if (openMenu === m.id) {
              setOpenMenu(null);
            } else {
              openAt(m.id);
            }
          }}
          onMouseEnter={() => {
            if (openMenu && openMenu !== m.id) openAt(m.id);
          }}
        >
          <span className="menubar-accel">{m.label[0]}</span>
          {m.label.slice(1)}
        </button>
      ))}
      {current && menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={current.items}
          onClose={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}
