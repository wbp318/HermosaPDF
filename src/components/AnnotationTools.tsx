import clsx from "clsx";
import { usePdfStore } from "../lib/store";
import { DEFAULT_COLORS, type Tool } from "../lib/annotations";

const TOOLS: { id: Tool; label: string; title: string }[] = [
  { id: "select", label: "↖", title: "Select / move (V)" },
  { id: "freehand", label: "✎", title: "Freehand draw (P)" },
  { id: "text", label: "T", title: "Text box (T)" },
  { id: "sticky", label: "•", title: "Sticky note (S)" },
];

export function AnnotationTools() {
  const tool = usePdfStore((s) => s.tool);
  const setTool = usePdfStore((s) => s.setTool);
  const color = usePdfStore((s) => s.annotationColor);
  const setColor = usePdfStore((s) => s.setAnnotationColor);
  const strokeWidth = usePdfStore((s) => s.strokeWidth);
  const setStrokeWidth = usePdfStore((s) => s.setStrokeWidth);
  const selectedId = usePdfStore((s) => s.selectedAnnotationId);
  const removeAnnotation = usePdfStore((s) => s.removeAnnotation);

  return (
    <div className="annotation-tools">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={clsx("tool-btn", tool === t.id && "active")}
            title={t.title}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tool-group">
        {DEFAULT_COLORS.map((c) => (
          <button
            key={c}
            className={clsx("color-swatch", color === c && "active")}
            style={{ background: c }}
            title={c}
            onClick={() => setColor(c)}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.currentTarget.value)}
          title="Custom color"
          className="color-picker"
        />
      </div>
      {tool === "freehand" && (
        <div className="tool-group">
          <span className="muted">Width</span>
          <input
            type="range"
            min={0.5}
            max={10}
            step={0.5}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.currentTarget.value))}
            style={{ width: 80 }}
          />
          <span className="muted">{strokeWidth}</span>
        </div>
      )}
      {selectedId && (
        <div className="tool-group right">
          <button
            className="danger"
            onClick={() => removeAnnotation(selectedId)}
            title="Delete selected (Del)"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
