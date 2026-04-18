import { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Line,
  Text,
  Rect,
  Group,
  Circle,
  Image as KonvaImage,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import { usePdfStore } from "../lib/store";
import { newId, type Annotation } from "../lib/annotations";

interface Props {
  pageId: number;
  pageWidth: number;
  pageHeight: number;
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

  const pendingSignatureId = usePdfStore((s) => s.pendingSignatureId);
  const signatures = usePdfStore((s) => s.signatures);
  const setPendingSignature = usePdfStore((s) => s.setPendingSignature);

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const [drawingPoints, setDrawingPoints] = useState<number[] | null>(null);

  const pageAnns = useMemo(
    () => annotations.filter((a) => a.pageId === pageId),
    [annotations, pageId],
  );

  const stageWidth = pageWidth * screenScale;
  const stageHeight = pageHeight * screenScale;

  // Attach the Transformer to whatever signature is currently selected.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const selected = annotations.find((a) => a.id === selectedId);
    const node = selectedId ? nodeRefs.current.get(selectedId) : null;
    if (node && selected?.type === "signature") {
      tr.nodes([node]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, annotations]);

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

    if (tool === "select") {
      const target = e.target;
      // Clear selection when clicking empty area (stage itself or its pinned rect)
      if (target === stage || target.name() === "bg") setSelected(null);
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

    if (tool === "sign" && pendingSignatureId) {
      const sig = signatures.find((s) => s.id === pendingSignatureId);
      if (!sig) return;
      const targetWidth = 180;
      const ratio = sig.nativeHeight / sig.nativeWidth;
      const targetHeight = targetWidth * ratio;
      // Center the placed signature on the click point so the cursor ends up
      // roughly where the user wanted the signature to sit.
      addAnnotation({
        type: "signature",
        id: newId(),
        pageId,
        x: px - targetWidth / 2,
        y: py - targetHeight / 2,
        width: targetWidth,
        height: targetHeight,
        dataUrl: sig.dataUrl,
      });
      setPendingSignature(null);
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

  const makeCommon = (a: Annotation) => ({
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool !== "select") return;
      e.cancelBubble = true;
      setSelected(a.id);
    },
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (tool === "select") e.cancelBubble = true;
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
  });

  const renderAnnotation = (a: Annotation) => {
    const isSelected = a.id === selectedId;
    const common = makeCommon(a);

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
      case "signature": {
        return (
          <SignatureImage
            key={a.id}
            dataUrl={a.dataUrl}
            x={a.x * screenScale}
            y={a.y * screenScale}
            width={a.width * screenScale}
            height={a.height * screenScale}
            isSelected={isSelected}
            onClick={common.onClick}
            onMouseDown={common.onMouseDown}
            draggable={common.draggable}
            onDragEnd={common.onDragEnd}
            onTransformEnd={(e) => {
              const node = e.target;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              node.scaleX(1);
              node.scaleY(1);
              updateAnnotation(a.id, {
                x: node.x() / screenScale,
                y: node.y() / screenScale,
                width: (node.width() * scaleX) / screenScale,
                height: (node.height() * scaleY) / screenScale,
              });
            }}
            registerNode={(node) => {
              if (node) nodeRefs.current.set(a.id, node);
              else nodeRefs.current.delete(a.id);
            }}
          />
        );
      }
    }
  };

  const cursor =
    tool === "sign" && pendingSignatureId
      ? "copy"
      : tool === "select"
        ? "default"
        : "crosshair";

  return (
    <div
      className="annotation-layer"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: stageWidth,
        height: stageHeight,
        cursor,
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
        <Layer>
          {/* Transparent background rect — captures clicks on empty space */}
          {tool !== "select" && (
            <Rect
              name="bg"
              x={0}
              y={0}
              width={stageWidth}
              height={stageHeight}
              fill="rgba(0,0,0,0)"
            />
          )}
          {pageAnns.map(renderAnnotation)}
          {drawingPoints && drawingPoints.length >= 2 && (
            <Line
              points={drawingPoints.map((v) => v * screenScale)}
              stroke={color}
              strokeWidth={Math.max(1, strokeWidth * screenScale)}
              lineCap="round"
              lineJoin="round"
              tension={0.3}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={true}
            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
            anchorSize={9}
            anchorStroke="#6ba6ff"
            anchorFill="#1a1a1d"
            borderStroke="#6ba6ff"
            borderDash={[4, 3]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}

function SignatureImage({
  dataUrl,
  x,
  y,
  width,
  height,
  isSelected,
  registerNode,
  onClick,
  onMouseDown,
  onDblClick,
  draggable,
  onDragEnd,
  onTransformEnd,
}: {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  registerNode: (node: Konva.Node | null) => void;
  onClick?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseDown?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDblClick?: () => void;
  draggable?: boolean;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (e: Konva.KonvaEventObject<Event>) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = dataUrl;
  }, [dataUrl]);

  if (!img) return null;

  return (
    <KonvaImage
      ref={(node) => registerNode(node)}
      image={img}
      x={x}
      y={y}
      width={width}
      height={height}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onDblClick={onDblClick}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
      shadowColor={isSelected ? "#6ba6ff" : undefined}
      shadowBlur={isSelected ? 8 : 0}
    />
  );
}
