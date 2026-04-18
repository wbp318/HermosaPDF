import { TitleBar } from "./components/TitleBar";
import { MenuBar } from "./components/MenuBar";
import { Toolbar } from "./components/Toolbar";
import { Thumbnails } from "./components/Thumbnails";
import { Viewer } from "./components/Viewer";
import { OcrProgressModal } from "./components/OcrProgressModal";
import { AiPanel } from "./components/AiPanel";
import { StatusBar } from "./components/StatusBar";
import { useKeyboardShortcuts } from "./lib/keyboard";
import "./App.css";

export default function App() {
  useKeyboardShortcuts();
  return (
    <div className="app">
      <TitleBar />
      <MenuBar />
      <Toolbar />
      <div className="workspace">
        <Thumbnails />
        <Viewer />
        <AiPanel />
      </div>
      <StatusBar />
      <OcrProgressModal />
    </div>
  );
}
