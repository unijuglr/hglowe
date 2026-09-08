"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { previewSectionAction, resetSectionAction, saveSectionAction } from "../actions";
import type { SectionSource, SectionStyle } from "@/lib/sections";

// MDXEditor only runs in the browser.
const VisualEditor = dynamic(() => import("./visual-editor"), {
  ssr: false,
  loading: () => <div className="visual-editor-loading">Loading editor…</div>,
});

type Mode = "visual" | "source";

/** If the visual editor throws while rendering, report it and let the parent fall back to source mode. */
class VisualBoundary extends Component<{ onError: (message: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface Props {
  id: string;
  style: SectionStyle;
  initialMdx: string;
  defaultMdx: string;
  source: SectionSource;
  canSave: boolean;
  initialPreview: ReactNode;
}

export function Editor({ id, style, initialMdx, defaultMdx, source, canSave, initialPreview }: Props) {
  const [mdx, setMdx] = useState(initialMdx);
  const [saved, setSaved] = useState(initialMdx);
  const [mode, setMode] = useState<Mode>("visual");
  // Remount the visual editor whenever we switch into it so it picks up source-mode edits.
  const [visualKey, setVisualKey] = useState(0);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReactNode>(initialPreview);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [currentSource, setCurrentSource] = useState<SectionSource>(source);
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = mdx !== saved;

  // Live preview: re-render on the server ~600ms after typing stops.
  useEffect(() => {
    if (mdx === saved && preview === initialPreview) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const result = await previewSectionAction(id, mdx, style);
      if (result.ok) {
        setPreview(result.node);
        setPreviewError(null);
      } else {
        setPreviewError(result.error);
      }
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mdx]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "visual") {
      setVisualError(null);
      setVisualKey((k) => k + 1);
    }
    setMode(next);
  }

  function replaceContent(next: string) {
    setMdx(next);
    setStatus(null);
    if (mode === "visual") setVisualKey((k) => k + 1);
  }

  function save() {
    startTransition(async () => {
      const result = await saveSectionAction(id, mdx);
      if (result.ok) {
        setSaved(mdx);
        setCurrentSource("firestore");
        setStatus({ kind: "ok", text: result.message ?? "Saved." });
      } else {
        setStatus({ kind: "err", text: result.error });
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await resetSectionAction(id);
      setConfirmReset(false);
      if (result.ok) {
        replaceContent(defaultMdx);
        setSaved(defaultMdx);
        setCurrentSource("default");
        setStatus({ kind: "ok", text: result.message ?? "Reset." });
      } else {
        setStatus({ kind: "err", text: result.error });
      }
    });
  }

  return (
    <div className="editor">
      <div className="btn-row">
        <button className="btn" type="button" onClick={save} disabled={pending || !dirty || !canSave}>
          {pending ? "Working…" : dirty ? "Save changes" : "Saved"}
        </button>
        <button className="btn secondary" type="button" onClick={() => replaceContent(saved)} disabled={pending || !dirty}>
          Discard edits
        </button>
        {currentSource === "firestore" ? (
          confirmReset ? (
            <>
              <span>Throw away the saved edit and go back to the built-in default?</span>
              <button className="btn danger" type="button" onClick={reset} disabled={pending}>
                Yes, reset
              </button>
              <button className="btn secondary" type="button" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn danger" type="button" onClick={() => setConfirmReset(true)} disabled={pending}>
              Reset to default…
            </button>
          )
        ) : (
          <span className="badge default">Using built-in default</span>
        )}
      </div>

      {status ? <div className={`notice ${status.kind}`}>{status.text}</div> : null}

      <div className="editor-grid">
        <div>
          <div className="mode-row">
            <h2 style={{ margin: 0 }}>Content</h2>
            <div className="segmented" role="tablist" aria-label="Editor mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "visual"}
                className={mode === "visual" ? "on" : ""}
                onClick={() => switchMode("visual")}
              >
                Visual
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "source"}
                className={mode === "source" ? "on" : ""}
                onClick={() => switchMode("source")}
              >
                Source (MDX)
              </button>
            </div>
          </div>

          {mode === "visual" ? (
            <>
              {visualError ? (
                <div className="notice warn">
                  The visual editor couldn&apos;t open this content, so it&apos;s shown as source instead.
                  <br />
                  <code>{visualError}</code>
                </div>
              ) : null}
              {!visualError ? (
                <VisualBoundary
                  key={visualKey}
                  onError={(message) => {
                    setVisualError(message);
                    setMode("source");
                  }}
                >
                  <VisualEditor
                    markdown={mdx}
                    onChange={(md) => {
                      setMdx(md);
                      setStatus(null);
                    }}
                    onError={(message) => {
                      setVisualError(message);
                      setMode("source");
                    }}
                  />
                </VisualBoundary>
              ) : null}
            </>
          ) : (
            <textarea
              value={mdx}
              onChange={(e) => {
                setMdx(e.target.value);
                setStatus(null);
              }}
              spellCheck
              aria-label="Section content (MDX source)"
            />
          )}
        </div>
        <div>
          <h2 style={{ marginTop: 0 }}>Preview</h2>
          {previewError ? <div className="notice err">{previewError}</div> : null}
          <div className="preview">{preview}</div>
        </div>
      </div>
    </div>
  );
}
