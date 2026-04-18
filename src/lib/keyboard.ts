import { useEffect } from "react";
import { usePdfStore } from "./store";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const s = usePdfStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void s.openFromDialog();
        return;
      }
      if (ctrl && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (s.numPages > 0) void s.save();
        return;
      }
      if (ctrl && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (s.numPages > 0) void s.saveAs();
        return;
      }
      if (ctrl && e.key.toLowerCase() === "w") {
        e.preventDefault();
        if (s.numPages > 0) s.close();
        return;
      }
      if (ctrl && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        s.setZoom(s.zoom + 0.25);
        return;
      }
      if (ctrl && e.key === "-") {
        e.preventDefault();
        s.setZoom(s.zoom - 0.25);
        return;
      }
      if (ctrl && e.key === "0") {
        e.preventDefault();
        s.setZoom(1);
        return;
      }

      if (inField) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        s.setPage(s.currentPage - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        s.setPage(s.currentPage + 1);
        return;
      }

      // Tool hotkeys
      if (e.key === "v" || e.key === "V") {
        s.setTool("select");
        return;
      }
      if (e.key === "p" || e.key === "P") {
        s.setTool("freehand");
        return;
      }
      if (e.key === "t" || e.key === "T") {
        s.setTool("text");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && s.selectedAnnotationId) {
        e.preventDefault();
        s.removeAnnotation(s.selectedAnnotationId);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
