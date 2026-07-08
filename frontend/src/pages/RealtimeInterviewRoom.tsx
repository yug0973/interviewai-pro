import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mic,
  Volume2,
  AlertTriangle,
  Radio,
  Clock,
  LogOut,
  Send,
  XCircle,
} from "lucide-react";
import { realtimeApi, type RealtimeSessionDetail } from "@/lib/api";
import { useRealtimeInterview } from "@/lib/useRealtimeInterview";
import { DeviceCheckView } from "@/components/interview/realtime/DeviceCheckView";

// ─── Text fallback for when voice recognition doesn't work ──────────────────
function TextFallback({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    onSubmit(trimmed);
    setText("");
    setTimeout(() => setSending(false), 1000);
  }

  return (
    <div className="flex items-center gap-2 border-t border-line pt-3">
      <span className="font-mono text-[10px] text-static-dim shrink-0">Type instead:</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="Type your answer and press Enter…"
        className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-signal placeholder:text-static-dim focus:border-alert focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!text.trim() || sending}
        className="flex items-center gap-1 rounded-md bg-alert px-3 py-1.5 font-mono text-[11px] font-semibold text-void hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        <Send size={11} />
        {sending ? "Sent!" : "Send"}
      </button>
    </div>
  );
}

export function RealtimeInterviewRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<RealtimeSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [activeMedia, setActiveMedia] = useState<{
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
    screenStream: MediaStream | null;
  } | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const candidateVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Load session metadata
  useEffect(() => {
    if (!id) return;
    realtimeApi
      .get(id)
      .then((data) => {
        setSession(data.session);
        if (data.session.status === "COMPLETED" || data.session.status === "TERMINATED") {
          navigate(`/interviews/results/${id}`);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load interview session");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Real-time interview orchestrator hook
  const rt = useRealtimeInterview({
    sessionId: id || "",
    enabled: deviceVerified && Boolean(session && session.status === "IN_PROGRESS"),
    onInterviewComplete: (sessionId) => {
      navigate(`/interviews/results/${sessionId}`);
    },
    onTerminated: () => {
      // Handled via termination modal
    },
  });

  // Stable references extracted from rt to avoid stale closures in effects
  const { connectionState, triggerDeviceReady } = rt;

  // Attach media streams when devices are verified
  useEffect(() => {
    if (activeMedia?.videoStream && candidateVideoRef.current) {
      candidateVideoRef.current.srcObject = activeMedia.videoStream;
    }
    if (activeMedia?.screenStream && screenVideoRef.current) {
      screenVideoRef.current.srcObject = activeMedia.screenStream;
    }
  }, [activeMedia, deviceVerified]);

  // Elapsed interview timer
  useEffect(() => {
    if (!deviceVerified || rt.terminated || rt.isCompleted) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [deviceVerified, rt.isCompleted, rt.terminated]);

  // Trigger initial AI greeting once entering the live room
  const hasTriggeredGreeting = useRef(false);
  useEffect(() => {
    if (deviceVerified && connectionState === "CONNECTED" && !hasTriggeredGreeting.current) {
      hasTriggeredGreeting.current = true;
      triggerDeviceReady();
    }
  }, [deviceVerified, connectionState, triggerDeviceReady]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="flex items-center gap-3 font-mono text-sm text-alert">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-alert border-t-transparent" />
          <span>Initializing Real-Time Interview Environmentâ€¦</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-rose-300">
          <XCircle size={32} className="mx-auto mb-2 text-rose-400" />
          <h2 className="text-lg font-bold">Failed to Load Interview Room</h2>
          <p className="text-xs text-static mt-1">{error || "Interview not found"}</p>
          <button
            type="button"
            onClick={() => navigate("/interviews")}
            className="mt-4 rounded-lg bg-surface px-4 py-2 text-xs font-mono text-signal hover:bg-surface-raised"
          >
            Return to Interviews
          </button>
        </div>
      </div>
    );
  }

  // Pre-interview device readiness gate
  if (!deviceVerified) {
    return (
      <DeviceCheckView
        targetRole={session.targetRole}
        interviewType={session.interviewType}
        onReady={(media) => {
          setActiveMedia(media);
          setDeviceVerified(true);
        }}
      />
    );
  }

  return (
    <div className="relative min-h-[90vh] flex flex-col justify-between space-y-4 pb-6 select-none">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-strong bg-void-dark px-5 py-3.5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              LIVE SESSION
            </span>
          </div>
          <span className="text-static-dim">Â·</span>
          <span className="font-bold text-signal text-sm">{session.targetRole}</span>
          <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-alert">
            {session.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Timer */}
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1 font-mono text-xs text-signal">
            <Clock size={13} className="text-alert" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* Authoritative Warning Indicator */}
          <div
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-all ${
              rt.warningCount > 0
                ? "border border-rose-500/50 bg-rose-950/30 text-rose-300 animate-pulse font-bold"
                : "border border-line bg-surface text-static"
            }`}
          >
            <AlertTriangle size={13} className={rt.warningCount > 0 ? "text-rose-400" : "text-static-dim"} />
            <span>
              Warnings: {rt.warningCount} / {rt.maxWarnings}
            </span>
          </div>

          {/* Connection Pill */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-static">
            <span
              className={`h-2 w-2 rounded-full ${
                rt.connectionState === "CONNECTED"
                  ? "bg-emerald-400"
                  : rt.connectionState === "CONNECTING"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-rose-400"
              }`}
            />
            <span className="hidden sm:inline-block">{rt.connectionState}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Are you sure you want to exit the live interview?")) {
                realtimeApi.finalize(session.id).then(() => navigate(`/interviews/results/${session.id}`));
              }
            }}
            className="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-static hover:text-rose-400 hover:border-rose-500/40 transition-colors"
          >
            <LogOut size={13} />
            <span className="hidden md:inline">End</span>
          </button>
        </div>
      </div>

      {/* Warning Toast Banner */}
      {rt.warningAlert?.active && (
        <div className="rounded-xl border border-rose-500 bg-rose-950/90 p-4 text-rose-200 shadow-2xl animate-bounce space-y-1">
          <div className="flex items-center gap-2 font-mono font-bold text-sm text-rose-100">
            <AlertTriangle size={16} className="text-rose-400" />
            <span>
              INTEGRITY WARNING {rt.warningAlert.warningNumber} OF {rt.warningAlert.maxWarnings}
            </span>
          </div>
          <p className="text-xs text-rose-200">{rt.warningAlert.reason}</p>
          <p className="text-[11px] font-mono text-rose-300">
            {rt.warningAlert.remainingWarnings} warning(s) remaining before automated session termination.
          </p>
        </div>
      )}

      {/* 2. Main Center Stage: AI Interviewer Avatar & Speech Visualizer */}
      <div className="rounded-2xl border border-line-strong bg-void-dark p-6 sm:p-10 flex flex-col items-center justify-center text-center space-y-6 shadow-2xl relative overflow-hidden min-h-[320px]">
        {/* Background glow animation when AI is speaking */}
        {rt.aiState === "SPEAKING" && (
          <div className="absolute inset-0 bg-radial from-alert/15 via-transparent to-transparent pointer-events-none animate-pulse" />
        )}

        {/* AI Interviewer Avatar Ring */}
        <div className="relative flex items-center justify-center">
          <div
            className={`flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-full border-2 transition-all duration-300 ${
              rt.aiState === "SPEAKING"
                ? "border-alert bg-alert/10 shadow-[0_0_50px_rgba(249,115,22,0.3)] scale-105"
                : rt.aiState === "THINKING"
                ? "border-amber-400 bg-amber-950/20 animate-pulse"
                : "border-line-strong bg-surface"
            }`}
          >
            {rt.aiState === "SPEAKING" ? (
              <Volume2 className="h-12 w-12 text-alert animate-pulse" />
            ) : rt.aiState === "THINKING" ? (
              <Radio className="h-12 w-12 text-amber-400 animate-spin" />
            ) : (
              <Mic className="h-12 w-12 text-static-dim" />
            )}
          </div>

          {/* Radiating soundwave rings */}
          {rt.aiState === "SPEAKING" && (
            <span className="absolute h-44 w-44 rounded-full border border-alert/30 animate-ping pointer-events-none" />
          )}
        </div>

        {/* AI Status Badge */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 font-mono text-xs shadow-inner">
            {rt.aiState === "SPEAKING" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-alert animate-ping" />
                <span className="text-alert font-bold uppercase tracking-wider">AI Interviewer Speaking</span>
              </>
            ) : rt.aiState === "THINKING" ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-semibold">AI is analyzing responseâ€¦</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-semibold">Listening to you (Speak naturally)</span>
              </>
            )}
          </div>
          <p className="text-[11px] font-mono text-static-dim mt-2">Topic: {rt.currentTopic}</p>
        </div>

        {/* Live Subtitle & Transcript Display */}
        <div className="max-w-2xl w-full rounded-xl border border-line bg-surface/50 p-4 backdrop-blur-sm space-y-2">
          {rt.aiCurrentSpeech ? (
            <p className="text-sm sm:text-base font-body text-signal leading-relaxed italic">
              "{rt.aiCurrentSpeech}"
            </p>
          ) : (
            <p className="text-xs font-mono text-static-dim">
              AI Interviewer is preparing your next scenarioâ€¦
            </p>
          )}

          {/* Candidate live voice transcription preview */}
          {(rt.liveTranscript.partial || rt.liveTranscript.final) && (
            <div className="pt-2 border-t border-line/60 text-left flex items-start gap-2">
              <span className="font-mono text-[10px] text-alert font-bold uppercase shrink-0 mt-0.5">
                You:
              </span>
              <p className="text-xs text-alert font-mono leading-relaxed">
                {rt.liveTranscript.final} <span className="italic opacity-75">{rt.liveTranscript.partial}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Lower Stage: Candidate Video & Screen Share PiP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate WebCam Video Stream */}
        <div className="rounded-2xl border border-line-strong bg-void-dark p-3 space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs text-signal font-semibold">Candidate Camera Feed</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active Video
            </span>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-void border border-line-dim flex items-center justify-center">
            <video
              ref={candidateVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover transform -scale-x-100"
            />
          </div>
        </div>

        {/* Candidate Screen Share Live Mirror */}
        <div className="rounded-2xl border border-line-strong bg-void-dark p-3 space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs text-signal font-semibold">Live Screen Share Mirror</span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Monitored Display
            </span>
          </div>

          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-void border border-line-dim flex items-center justify-center">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* 4. Controls: voice status + text fallback */}
      <div className="rounded-xl border border-line bg-void-dark px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-static">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${rt.vadState === "CANDIDATE_SPEAKING" || rt.vadState === "POSSIBLE_END_OF_TURN" ? "bg-alert animate-pulse" : "bg-emerald-400"}`} />
            <span>
              {rt.vadState === "CANDIDATE_SPEAKING" ? "Voice detected — keep speaking…" :
               rt.vadState === "POSSIBLE_END_OF_TURN" ? "Pause detected — submitting soon…" :
               rt.vadState === "TURN_FINALIZED" ? "Sending your answer…" :
               "Listening for your voice (speak naturally)"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {rt.aiState === "SPEAKING" && (
              <button
                type="button"
                onClick={rt.triggerBargeIn}
                className="rounded-md border border-alert/40 bg-alert/15 px-3 py-1 font-mono text-[11px] text-alert hover:bg-alert/25 transition-colors"
              >
                Interrupt AI
              </button>
            )}
            {rt.liveTranscript.final && rt.aiState !== "THINKING" && (
              <button
                type="button"
                onClick={rt.finalizeCandidateSpeech}
                className="flex items-center gap-1 rounded-md bg-alert px-3 py-1 font-mono text-[11px] font-semibold text-void hover:opacity-90 transition-opacity"
              >
                <Send size={11} />
                <span>Done Speaking</span>
              </button>
            )}
          </div>
        </div>

        {/* Text fallback — always available if voice doesn't work */}
        {rt.aiState === "LISTENING" && (
          <TextFallback onSubmit={rt.sendText} />
        )}
        {/* Show recognition error if any */}
        {rt.recognitionError && (
          <p className="text-[11px] font-mono text-rose-400 pt-1">⚠ {rt.recognitionError}</p>
        )}
      </div>

      {/* 5. Termination Modal */}
      {rt.terminated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/90 p-4 backdrop-blur-md">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/40 bg-void-dark p-6 text-center space-y-4 shadow-2xl">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl font-bold text-rose-200">Interview Terminated</h2>
            <p className="text-xs text-static leading-relaxed">
              {rt.terminationReason || "The session was terminated because the maximum number of integrity warnings (3/3) was reached."}
            </p>

            <button
              type="button"
              onClick={() => navigate(`/interviews/results/${session.id}`)}
              className="w-full rounded-xl bg-rose-500 py-3 font-mono text-xs font-bold uppercase tracking-wider text-void hover:bg-rose-600 transition-colors shadow-lg"
            >
              View Integrity Report & Findings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
