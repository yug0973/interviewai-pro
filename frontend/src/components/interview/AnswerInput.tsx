import { useEffect, useState, type KeyboardEvent } from "react";
import { Mic, Square, Send, RotateCcw, AlertCircle, Volume2, Type } from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

interface AnswerInputProps {
  mode: "TEXT" | "VOICE";
  onSubmit: (answerText: string) => void;
  submitting: boolean;
}

export function AnswerInput({ mode: initialMode, onSubmit, submitting }: AnswerInputProps) {
  const [activeMode, setActiveMode] = useState<"TEXT" | "VOICE">(initialMode);
  const [text, setText] = useState("");
  const speech = useSpeechRecognition();

  // Sync speech recognition transcript into the editable text area
  useEffect(() => {
    if (speech.transcript) {
      setText(speech.transcript);
    }
  }, [speech.transcript]);

  function handleSubmit() {
    if (!text.trim() || submitting) return;
    if (speech.listening) speech.stop();
    onSubmit(text.trim());
    setText("");
    speech.reset();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleReset() {
    setText("");
    speech.reset();
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-4">
      {/* Mode Switcher Pill */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-void p-1">
          <button
            type="button"
            onClick={() => {
              if (speech.listening) speech.stop();
              setActiveMode("TEXT");
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-mono transition-colors ${
              activeMode === "TEXT"
                ? "bg-surface-raised text-signal font-semibold shadow-xs"
                : "text-static hover:text-signal"
            }`}
          >
            <Type size={13} />
            Text Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("VOICE")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-mono transition-colors ${
              activeMode === "VOICE"
                ? "bg-alert/15 text-alert font-semibold shadow-xs"
                : "text-static hover:text-signal"
            }`}
          >
            <Mic size={13} />
            Voice Mode
          </button>
        </div>

        <span className="font-mono text-[11px] text-static-dim hidden sm:inline-block">
          {activeMode === "VOICE" ? "Speech-to-Text Enabled" : "Manual Response"}
        </span>
      </div>

      {/* Voice Mode Controls & Audio Visualizer */}
      {activeMode === "VOICE" ? (
        speech.supported ? (
          <div className="rounded-xl border border-line-strong bg-void p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={submitting}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                    speech.listening
                      ? "bg-rose-500 text-void ring-4 ring-rose-500/30 scale-105"
                      : "bg-alert/15 text-alert hover:bg-alert/25 ring-1 ring-alert/40"
                  }`}
                  aria-label={speech.listening ? "Stop recording" : "Start speaking"}
                >
                  {speech.listening ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-6 w-6" />}
                </button>

                <div>
                  <p className="text-sm font-semibold text-signal">
                    {speech.listening ? "Listening to your answer…" : "Tap microphone to speak"}
                  </p>
                  <p className="text-xs text-static font-mono">
                    {speech.listening ? "Speak naturally. Your answer will transcribe below." : "Click mic when ready"}
                  </p>
                </div>
              </div>

              {speech.listening && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface">
                  <Volume2 size={14} className="text-alert animate-pulse" />
                  <div className="flex items-center gap-0.5 h-4">
                    {[1, 2, 3, 4, 5].map((bar) => {
                      const heightPercent = Math.max(20, Math.min(100, speech.audioLevel * (bar * 0.3)));
                      return (
                        <div
                          key={bar}
                          className="w-1 rounded-full bg-alert transition-all duration-75"
                          style={{ height: `${speech.listening ? heightPercent : 20}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {speech.error && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-300 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{speech.error}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => speech.start()}
                    className="rounded-md border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-900/40"
                  >
                    Retry Voice
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode("TEXT")}
                    className="rounded-md border border-line-strong bg-void px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-static hover:text-signal"
                  >
                    Type Response Instead
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 text-xs text-amber-300">
            Voice recognition is not supported in this browser. You can type your answer below.
          </div>
        )
      ) : null}

      {/* Answer Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            activeMode === "VOICE"
              ? "Live speech transcript will appear here — you can edit or format before submitting."
              : "Type your structured technical response here… (Press Cmd+Enter / Ctrl+Enter to submit)"
          }
          rows={6}
          disabled={submitting}
          className="w-full resize-y rounded-xl border border-line-strong bg-void px-4 py-3.5 text-sm text-signal placeholder-static-dim outline-none transition-colors focus:border-alert font-body leading-relaxed disabled:opacity-50"
        />

        {/* Live Interim Transcript Hint */}
        {speech.interimTranscript && (
          <p className="mt-1 text-xs text-alert italic font-mono animate-pulse">
            Transcribing: "{speech.interimTranscript}"
          </p>
        )}
      </div>

      {/* Footer Info & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3 text-xs text-static font-mono">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{text.length} characters</span>
        </div>

        <div className="flex items-center gap-2">
          {text.trim() && !submitting ? (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-2 text-xs text-static hover:text-signal hover:bg-surface-raised transition-colors"
            >
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-alert px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-void border-t-transparent" />
                <span>Evaluating Answer…</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>Submit Answer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
