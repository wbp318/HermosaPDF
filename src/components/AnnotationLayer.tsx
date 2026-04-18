import { useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Text, Rect, Group, Circle } from "react-konva";
import type Konva from "konva";
import { usePdfStore } from "../lib/store";
import { newId, type Annotation } from "../lib/annotations";

interface Props {
  pageId: number;
  // PDF page width/height in points
  pageWidth: number;
  pageHeight: number;
  // Screen multiplier applied to PDF points
  screenScale: number;
}

export function AnnotationLayer({ pageId, pageWidth, pageHeight, screenScale }: Props) {
  const tool = usePdfStore((s) => s.tool);
  const annotations = usePdfStore((s) => s.annotations);
  const selectedId = usePdfStore((s) => s.selectedAnnotationId);
  const color = usePdfStore((s) => s.annotationColor);
  const strokeWidth = usePdfStore((s) => s.strokeWidth);
  const addAnnotation = usePdfStore((s) => s.addAnnotation);
  const updateAnnotation = usePdfStore((s) => s.updateAnnotation);
  const removeAnnotation = usePdfStore((s) => s.removeAnnotation);
  const setSelected = usePdfStore((s) => s.setSelectedAnnotation);

  const stageRef = useRef<Konva.Stage | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<number[] | null>(null);

  const pageAnns = useMemo(
    () => annotations.filter((a) => a.pageId === pageId),
    [annotations, pageId],
  );

  const stageWidth = pageWidth * screenScale;
  const stageHeight = pageHeight * screenScale;

  const toPdf = (sx: number, sy: number): [number, number] => [
    sx / screenScale,
    sy / screenScale,
  ];

  const onMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const [px, py] = toPdf(pos.x, pos.y);

    // Click on the stage (not a shape) while in select mode → clear selection
    if (tool === "select") {
      if (e.target === stage) setSelected(null);
      return;
    }

    if (tool === "freehand") {
      setDrawingPoints([px, py]);
      return;
    }

    if (tool === "text") {
      const content = window.prompt("Text:");
      if (!content) return;
      addAnnotation({
        type: "text",
        id: newId(),
        pageId,
        x: px,
        y: py,
        content,
        fontSize: 14,
        color,
      });
      return;
    }

    if (tool === "sticky") {
      const content = window.prompt("Sticky note:");
      if (!content) return;
      addAnnotation({
        type: "sticky",
        id: newId(),
        pageId,
        x: px,
        y: py,
        content,
        color,
      });
      return;
    }
  };

  const onMouseMove = () => {
    if (tool !== "freehand" || !drawingPoints) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const [px, py] = toPdf(pos.x, pos.y);
    setDrawingPoints((pts) => (pts ? [...pts, px, py] : null));
  };

  const onMouseUp = () => {
    if (tool !== "freehand" || !drawingPoints) return;
    if (drawingPoints.length >= 4) {
      const pairs: [number, number][] = [];
      for (let i = 0; i < drawingPoints.length; i += 2) {
        pairs.push([drawingPoints[i], drawingPoints[i + 1]]);
      }
      addAnnotation({
        type: "freehand",
        id: newId(),
        pageId,
        points: pairs,
        color,
        width: strokeWidth,
      });
    }
    setDrawingPoints(null);
  };

  const renderAnnotation = (a: Annotation) => {
    const isSelected = a.id === selectedId;
    const common = {
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (tool !== "select") return;
        e.cancelBubble = true;
        setSelected(a.id);
      },
      onDblClick: () => {
        if (a.type === "text" || a.type === "sticky") {
          const next = window.prompt("Edit:", a.content);
          if (next !== null) updateAnnotation(a.id, { content: next });
        }
      },
      draggable: tool === "select",
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        const node = e.target;
        if (a.type === "freehand") {
          // Apply position delta to each point
          const dx = node.x() / screenScale;
          const dy = node.y() / screenScale;
          const moved = a.points.map(
            ([x, y]) => [x + dx, y + dy] as [number, number],
          );
          updateAnnotation(a.id, { points: moved });
          node.position({ x: 0, y: 0 });
        } else {
          updateAnnotation(a.id, {
            x: node.x() / screenScale,
            y: node.y() / screenScale,
          });
        }
      },
    };

    switch (a.type) {
      case "freehand": {
        const flat = a.points.flatMap(([x, y]) => [x * screenScale, y * screenScale]);
        return (
          <Line
            key={a.id}
            {...common}
            points={flat}
            stroke={a.color}
            strokeWidth={Math.max(1, a.width * screenScale)}
            lineCap="round"
            lineJoin="round"
            tension={0.3}
            hitStrokeWidth={Math.max(8, a.width * screenScale * 2)}
            shadowColor={isSelected ? "#6ba6ff" : undefined}
            shadowBlur={isSelected ? 6 : 0}
          />
        );
      }
      case "text": {
        return (
          <Text
            key={a.id}
            {...common}
            x={a.x * screenScale}
            y={a.y * screenScale}
            text={a.content}
            fontSize={a.fontSize * screenScale}
            fill={a.color}
            shadowColor={isSelected ? "#6ba6ff" : undefined}
            shadowBlur={isSelected ? 6 : 0}
          />
        );
      }
      case "sticky": {
        return (
          <Group
            key={a.id}
            {...common}
            x={a.x * screenScale}
            y={a.y * screenScale}
          >
            <Circle
              radius={10 * screenScale * 0.6}
              fill={a.color}
              stroke={isSelected ? "#6ba6ff" : "#000"}
              strokeWidth={isSelected ? 2 : 0.5}
            />
            <Text
              x={14 * screenScale * 0.6}
              y={-6 * screenScale * 0.6}
              text={a.content}
              fontSize={12 * screenScale}
              fill="#111"
            />
          </Group>
        );
      }
    }
  };

  // Pointer events passthrough when in select mode — let the page canvas be interactive
  // Actually: Konva Stage always captures the area it covers. We set the CSS
  // to pointer-events: auto always and rely on clicks on empty areas to clear
  // selection. Text/sticky creation uses prompt() which is synchronous enough.
  return (
    <div
      className="annotation-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: stageWidth,
        height: stageHeight,
        cursor: tool === "select" ? "default" : "crosshair",
      }}
      onKeyDown={(e) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
          removeAnnotation(selectedId);
        }
      }}
      tabIndex={-1}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <Layer listening={tool === "select"}>
          {pageAnns.map(renderAnnotation)}
          {drawingPoints && drawingPoints.length >= 2 && (
            <Line
              points={drawingPoints.map((v, i) =>
                i % 2 === 0 ? v * screenScale : v * screenScale,
              )}
              stroke={color}
              strokeWidth={Math.max(1, strokeWidth * screenScale)}
              lineCap="round"
              lineJoin="round"
              tension={0.3}
              listening={false}
            />
          )}
        </Layer>
        {/* Transparent hit rect under select mode so stage receives clicks in empty areas */}
        {tool !== "select" && (
          <Layer listening={true}>
            <Rect
              x={0}
              y={0}
              width={stageWidth}
              height={stageHeight}
              fill="rgba(0,0,0,0)"
            />
          </Layer>
        )}
      </Stage>
    </div>
  );
}
