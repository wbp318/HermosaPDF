import { Toolbar } from "./components/Toolbar";
import { Thumbnails } from "./components/Thumbnails";
import { Viewer } from "./components/Viewer";
import { OcrProgressModal } from "./components/OcrProgressModal";
import { AiPanel } from "./components/AiPanel";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Thumbnails />
        <Viewer />
        <AiPanel />
      </div>
      <OcrProgressModal />
    </div>
  );
}
