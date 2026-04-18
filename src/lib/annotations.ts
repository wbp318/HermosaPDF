// All annotation coordinates are in PDF page space (points, 72 per inch,
// origin top-left to match pdfjs). They persist to pageId (the stable
// identity) not to the current slot index, so reorders/deletes don't
// dislodge them from their page.

export type Tool = "select" | "freehand" | "text" | "sticky" | "sign";

export interface SignatureAsset {
  id: string;
  name: string;
  dataUrl: string; // PNG data URL
  nativeWidth: number;
  nativeHeight: number;
  createdAt: number;
}

export interface SignatureAnnotation {
  type: "signature";
  id: string;
  pageId: number;
  x: number;
  y: number;
  width: number; // in PDF points
  height: number;
  dataUrl: string;
}

export interface FreehandAnnotation {
  type: "freehand";
  id: string;
  pageId: number;
  points: [number, number][]; // flat-ish list of [x, y] in PDF coords
  color: string;
  width: number; // stroke width in PDF points
}

export interface TextAnnotation {
  type: "text";
  id: string;
  pageId: number;
  x: number;
  y: number;
  content: string;
  fontSize: number; // in PDF points
  color: string;
}

export interface StickyAnnotation {
  type: "sticky";
  id: string;
  pageId: number;
  x: number;
  y: number;
  content: string;
  color: string;
}

export type Annotation =
  | FreehandAnnotation
  | TextAnnotation
  | StickyAnnotation
  | SignatureAnnotation;

export const SIGNATURE_STORAGE_KEY = "hermosapdf.signatures";

export function loadSignatures(): SignatureAsset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function persistSignatures(sigs: SignatureAsset[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(sigs));
  } catch {
    // quota / disabled storage — skip
  }
}

export function newId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_COLORS = [
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#007aff",
  "#af52de",
  "#000000",
];
