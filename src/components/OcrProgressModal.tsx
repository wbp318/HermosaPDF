import { usePdfStore } from "../lib/store";

export function OcrProgressModal() {
  const progress = usePdfStore((s) => s.ocrProgress);
  if (!progress) return null;

  const pct = progress.pageTotal
    ? Math.round(((progress.pageIndex - 1) / progress.pageTotal) * 100)
    : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal ocr-modal">
        <div className="modal-header">
          <h2>Running OCR</h2>
        </div>
        <div className="modal-body">
          <p className="muted">
            Recognizing text on page {progress.pageIndex} of {progress.pageTotal}
          </p>
          <div className="ocr-progress-bar">
            <div
              className="ocr-progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="ocr-progress-msg">{progress.message}</p>
        </div>
      </div>
    </div>
  );
}
