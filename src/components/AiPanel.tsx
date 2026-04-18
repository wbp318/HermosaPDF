import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type Anthropic from "@anthropic-ai/sdk";
import { usePdfStore } from "../lib/store";
import { extractPdfText } from "../lib/convert";
import {
  askQuestion,
  extractFields,
  getApiKey,
  makeClient,
  redactSuggestions,
  summarize,
  MODEL_LABELS,
  type ChatMessage,
  type ModelTier,
  type RedactSuggestion,
} from "../lib/ai";
import { ApiKeyModal } from "./ApiKeyModal";

type Tab = "summarize" | "qa" | "extract" | "redact";

export function AiPanel() {
  const open = usePdfStore((s) => s.aiPanelOpen);
  const toggle = usePdfStore((s) => s.toggleAiPanel);
  const doc = usePdfStore((s) => s.doc);
  const filePath = usePdfStore((s) => s.filePath);
  const aiModel = usePdfStore((s) => s.aiModel);
  const setAiModel = usePdfStore((s) => s.setAiModel);

  const [tab, setTab] = useState<Tab>("summarize");
  const [keyState, setKeyState] = useState<"loading" | "missing" | string>("loading");
  const [showKeyModal, setShowKeyModal] = useState(false);

  // Cache the extracted document text so every AI call reuses the same bytes
  // (and therefore hits the Claude prompt cache).
  const [docText, setDocText] = useState<string | null>(null);
  const lastExtractedFilePath = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const key = await getApiKey();
      setKeyState(key ?? "missing");
      if (!key) setShowKeyModal(true);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !doc) {
      setDocText(null);
      lastExtractedFilePath.current = null;
      return;
    }
    if (lastExtractedFilePath.current === filePath) return;
    lastExtractedFilePath.current = filePath;
    setDocText(null);
    (async () => {
      try {
        const text = await extractPdfText(doc);
        setDocText(text);
      } catch {
        setDocText("");
      }
    })();
  }, [open, doc, filePath]);

  const client: Anthropic | null = useMemo(() => {
    if (keyState === "loading" || keyState === "missing") return null;
    return makeClient(keyState);
  }, [keyState]);

  if (!open) return null;

  const reloadKey = async () => {
    const k = await getApiKey();
    setKeyState(k ?? "missing");
    setShowKeyModal(false);
  };

  return (
    <>
      <aside className="ai-panel">
        <header className="ai-panel-header">
          <h2>AI</h2>
          <div className="ai-panel-header-actions">
            <select
              className="ai-model-select"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value as ModelTier)}
              title="Model tier (Haiku is cheapest and fastest)"
            >
              <option value="haiku">{MODEL_LABELS.haiku}</option>
              <option value="sonnet">{MODEL_LABELS.sonnet}</option>
              <option value="opus">{MODEL_LABELS.opus}</option>
            </select>
            <button
              className="ghost"
              onClick={() => setShowKeyModal(true)}
              title="Manage API key"
            >
              Key
            </button>
            <button className="ghost" onClick={toggle} title="Close panel">
              ✕
            </button>
          </div>
        </header>

        <div className="ai-tabs">
          {(["summarize", "qa", "extract", "redact"] as Tab[]).map((t) => (
            <button
              key={t}
              className={clsx("ai-tab", tab === t && "active")}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        <div className="ai-panel-body">
          {keyState === "loading" ? (
            <p className="muted">Loading…</p>
          ) : !client ? (
            <div className="ai-empty">
              <p>Add your Anthropic API key to use AI features.</p>
              <button className="primary" onClick={() => setShowKeyModal(true)}>
                Add key
              </button>
            </div>
          ) : !doc ? (
            <p className="muted">Open a PDF to use AI features.</p>
          ) : !docText ? (
            <p className="muted">Extracting document text…</p>
          ) : tab === "summarize" ? (
            <SummarizeTab client={client} docText={docText} tier={aiModel} />
          ) : tab === "qa" ? (
            <QATab client={client} docText={docText} tier={aiModel} />
          ) : tab === "extract" ? (
            <ExtractTab client={client} docText={docText} tier={aiModel} />
          ) : (
            <RedactTab client={client} docText={docText} tier={aiModel} />
          )}
        </div>
      </aside>

      {showKeyModal && (
        <ApiKeyModal
          hasExistingKey={keyState !== "missing" && keyState !== "loading"}
          onSaved={() => void reloadKey()}
          onClose={() => setShowKeyModal(false)}
        />
      )}
    </>
  );
}

function tabLabel(t: Tab): string {
  switch (t) {
    case "summarize":
      return "Summary";
    case "qa":
      return "Q&A";
    case "extract":
      return "Extract";
    case "redact":
      return "Redact";
  }
}

function SummarizeTab({
  client,
  docText,
  tier,
}: {
  client: Anthropic;
  docText: string;
  tier: ModelTier;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const out = await summarize(client, docText, tier);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-tab-body">
      <button onClick={run} disabled={busy} className="primary">
        {busy ? "Summarizing…" : result ? "Re-summarize" : "Summarize this document"}
      </button>
      {error && <p className="ai-error">{error}</p>}
      {result && <div className="ai-result">{result}</div>}
    </div>
  );
}

function QATab({
  client,
  docText,
  tier,
}: {
  client: Anthropic;
  docText: string;
  tier: ModelTier;
}) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    const nextHistory: ChatMessage[] = [...history, { role: "user", content: q }];
    setHistory(nextHistory);
    try {
      const answer = await askQuestion(client, docText, history, q, tier);
      setHistory([...nextHistory, { role: "assistant", content: answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-tab-body qa">
      <div className="ai-chat">
        {history.length === 0 && !busy && (
          <p className="muted">Ask any question about the document.</p>
        )}
        {history.map((m, i) => (
          <div key={i} className={clsx("ai-chat-msg", m.role)}>
            <div className="ai-chat-role">{m.role === "user" ? "You" : "Claude"}</div>
            <div className="ai-chat-content">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="ai-chat-msg assistant">
            <div className="ai-chat-role">Claude</div>
            <div className="ai-chat-content muted">Thinking…</div>
          </div>
        )}
        {error && <p className="ai-error">{error}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="ai-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask about the document…"
          rows={2}
        />
        <button onClick={send} disabled={busy || !input.trim()} className="primary">
          Send
        </button>
      </div>
    </div>
  );
}

function ExtractTab({
  client,
  docText,
  tier,
}: {
  client: Anthropic;
  docText: string;
  tier: ModelTier;
}) {
  const [fields, setFields] = useState("");
  const [result, setResult] = useState<Record<string, string | null> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const list = fields
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const out = await extractFields(client, docText, list, tier);
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-tab-body">
      <p className="muted">One field name per line. Example: <em>invoice number, total, due date</em>.</p>
      <textarea
        value={fields}
        onChange={(e) => setFields(e.target.value)}
        rows={5}
        placeholder={"invoice number\ntotal\ndue date"}
      />
      <button onClick={run} disabled={busy || !fields.trim()} className="primary">
        {busy ? "Extracting…" : "Extract"}
      </button>
      {error && <p className="ai-error">{error}</p>}
      {result && (
        <div className="ai-extract-results">
          {Object.entries(result).map(([k, v]) => (
            <div key={k} className="ai-extract-row">
              <div className="ai-extract-key">{k}</div>
              <div className="ai-extract-value">
                {v === null ? <span className="muted">(not found)</span> : String(v)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RedactTab({
  client,
  docText,
  tier,
}: {
  client: Anthropic;
  docText: string;
  tier: ModelTier;
}) {
  const [results, setResults] = useState<RedactSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const out = await redactSuggestions(client, docText, tier);
      setResults(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ai-tab-body">
      <p className="muted">
        Claude flags passages that look like personal/sensitive information. No
        changes are made to the PDF — this is a read-only suggestion list.
      </p>
      <button onClick={run} disabled={busy} className="primary">
        {busy ? "Scanning…" : results ? "Re-scan" : "Find PII"}
      </button>
      {error && <p className="ai-error">{error}</p>}
      {results && (
        <div className="ai-redact-results">
          {results.length === 0 ? (
            <p className="muted">Nothing flagged.</p>
          ) : (
            results.map((r, i) => (
              <div key={i} className="ai-redact-item">
                <div className="ai-redact-text">{r.text}</div>
                <div className="ai-redact-reason muted">{r.reason}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
