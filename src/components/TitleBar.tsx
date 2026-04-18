import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.listen<unknown>("tauri://resize", () => {
      win.isMaximized().then(setMaximized);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const minimize = () => getCurrentWindow().minimize();
  const toggleMax = () => getCurrentWindow().toggleMaximize();
  const close = () => getCurrentWindow().close();

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-icon" data-tauri-drag-region>
        <span className="titlebar-icon-glyph">H</span>
      </div>
      <div className="titlebar-title" data-tauri-drag-region>
        HermosaPDF
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          onClick={minimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <span className="tb-glyph">_</span>
        </button>
        <button
          className="titlebar-btn"
          onClick={toggleMax}
          title={maximized ? "Restore" : "Maximize"}
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          <span className="tb-glyph">{maximized ? "❐" : "□"}</span>
        </button>
        <button
          className="titlebar-btn close"
          onClick={close}
          title="Close"
          aria-label="Close"
        >
          <span className="tb-glyph">✕</span>
        </button>
      </div>
    </div>
  );
}
