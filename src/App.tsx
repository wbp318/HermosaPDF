import { Toolbar } from "./components/Toolbar";
import { Thumbnails } from "./components/Thumbnails";
import { Viewer } from "./components/Viewer";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      <div className="workspace">
        <Thumbnails />
        <Viewer />
      </div>
    </div>
  );
}
