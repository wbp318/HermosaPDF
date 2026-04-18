import { useState } from "react";
import { setApiKey, clearApiKey } from "../lib/ai";

interface Props {
  hasExistingKey: boolean;
  onSaved: () => void;
  onClose: () => void;
}

export function ApiKeyModal({ hasExistingKey, onSaved, onClose }: Props) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Key is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setApiKey(trimmed);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await clearApiKey();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Anthropic API Key</h2>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="muted">
            Stored in your OS keychain (Windows Credential Manager on Windows).
            Never saved to disk or the repo. Used only to call the Claude API
            on your behalf.
          </p>
          <input
            type="password"
            placeholder="sk-ant-…"
            value={key}
            autoFocus
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            className="api-key-input"
          />
          {error && <p className="api-key-error">{error}</p>}
          <div className="modal-row">
            {hasExistingKey && (
              <button onClick={clear} disabled={busy} className="danger-btn">
                Clear stored key
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button onClick={save} disabled={busy || !key.trim()} className="primary">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="api-key-hint muted">
            Get a key at{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
