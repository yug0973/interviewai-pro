import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Mic,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Ban,
} from "lucide-react";

type DeviceCheckState =
  | "CHECKING"
  | "READY"
  | "MIC_ERROR"
  | "CAMERA_ERROR"
  | "SCREEN_ERROR"
  | "BROWSER_UNSUPPORTED";

interface DeviceCheckViewProps {
  onReady: (media: {
    videoStream: MediaStream | null;
    audioStream: MediaStream | null;
    screenStream: MediaStream | null;
  }) => void;
  targetRole: string;
  interviewType: string;
}

/** Minimum measured level (0-100) before we consider the mic to have actually heard something. */
const MIC_ACTIVITY_THRESHOLD = 4;

function describeMediaError(err: unknown, device: "camera" | "microphone"): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `${device === "camera" ? "Camera" : "Microphone"} permission was denied. Allow access in your browser's site settings and retry.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} was found on this device. Connect a ${device} and retry.`;
    case "NotReadableError":
      return `Your ${device} is already in use by another application or browser tab. Close it and retry.`;
    case "AbortError":
      return `${device === "camera" ? "Camera" : "Microphone"} initialization was interrupted. Please retry.`;
    default:
      return `Could not access your ${device}. Please check your browser permissions and retry.`;
  }
}

export function DeviceCheckView({ onReady, targetRole, interviewType }: DeviceCheckViewProps) {
  const [state, setState] = useState<DeviceCheckState>("CHECKING");
  const [browserIssues, setBrowserIssues] = useState<string[]>([]);

  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [micHeardAudio, setMicHeardAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const [screenGranted, setScreenGranted] = useState(false);
  const [screenErrorMsg, setScreenErrorMsg] = useState<string | null>(null);

  const [cameraErrorMsg, setCameraErrorMsg] = useState<string | null>(null);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const [hasAudioInputDevice, setHasAudioInputDevice] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLVideoElement | null>(null);

  // Camera and microphone are two INDEPENDENT MediaStreams, each from its own
  // getUserMedia() call. Previously a single combined { video, audio } stream
  // was requested and its audio track was also wired into an AudioContext for
  // the level meter and then handed to a muted <video> element for the rest of
  // the interview — three consumers on one audio track for the life of the
  // session. Keeping the mic stream fully separate means it can be reasoned
  // about, metered, and released on its own without touching the camera track,
  // and it's the same stream (not a derivative) that the interview room and
  // any future STT pipeline receive.
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // ── Browser / environment compatibility (checked once, before requesting anything) ──
  useEffect(() => {
    const issues: string[] = [];

    if (!window.isSecureContext) {
      issues.push("This page is not served over HTTPS (or localhost). Camera, microphone, and speech recognition all require a secure context.");
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      issues.push("This browser does not support camera/microphone capture.");
    }
    const SpeechCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechCtor) {
      issues.push("This browser does not support the Web Speech API needed for voice answers. Please use a recent version of Chrome or Edge.");
    }
    if (!("speechSynthesis" in window)) {
      issues.push("This browser cannot play the AI interviewer's voice.");
    }

    setBrowserIssues(issues);
    if (issues.length > 0) setState("BROWSER_UNSUPPORTED");
  }, []);

  // ── Enumerate audio input devices (best-effort, informational only) ──
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setHasAudioInputDevice(devices.some((d) => d.kind === "audioinput")))
      .catch(() => setHasAudioInputDevice(null));
  }, [micGranted]);

  const stopMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => { });
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const startMeter = useCallback(
    (stream: MediaStream) => {
      stopMeter();
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextCtor();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const level = Math.min(100, Math.round((sum / data.length / 128) * 100));
        setAudioLevel(level);
        if (level >= MIC_ACTIVITY_THRESHOLD) setMicHeardAudio(true);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [stopMeter]
  );

  // ── Camera (video-only) ──────────────────────────────────────────────────
  const requestCamera = useCallback(async () => {
    setCameraErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      cameraStreamRef.current = stream;
      setCameraGranted(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraGranted(false);
      setCameraErrorMsg(describeMediaError(err, "camera"));
    }
  }, []);

  // ── Microphone (audio-only) ──────────────────────────────────────────────
  const requestMic = useCallback(async () => {
    setMicErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicGranted(true);
      startMeter(stream);
    } catch (err) {
      setMicGranted(false);
      setMicErrorMsg(describeMediaError(err, "microphone"));
    }
  }, [startMeter]);

  const requestScreenShare = useCallback(async () => {
    setScreenErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setScreenGranted(true);
      if (screenRef.current) screenRef.current.srcObject = stream;
      stream.getVideoTracks()[0].onended = () => {
        setScreenGranted(false);
        setScreenErrorMsg("Screen share was stopped. You can re-share it or continue with camera & mic only.");
      };
    } catch {
      setScreenGranted(false);
      setScreenErrorMsg("Screen sharing was cancelled or denied. You can continue with camera & mic only.");
    }
  }, []);

  // ── Kick off camera + mic requests once we know the browser can support them ──
  useEffect(() => {
    if (browserIssues.length > 0) return;
    requestCamera();
    requestMic();
    return () => {
      stopMeter();
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      // screenStreamRef is deliberately NOT stopped here: once granted it is
      // handed off via onReady() and owned by the interview room from then on.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserIssues.length]);

  // ── Derive overall state from the two REQUIRED devices ───────────────────
  useEffect(() => {
    if (browserIssues.length > 0) return;
    if (cameraGranted && micGranted) {
      setState("READY");
    } else if (cameraErrorMsg && !cameraGranted) {
      setState("CAMERA_ERROR");
    } else if (micErrorMsg && !micGranted) {
      setState("MIC_ERROR");
    } else {
      setState("CHECKING");
    }
  }, [browserIssues.length, cameraGranted, micGranted, cameraErrorMsg, micErrorMsg]);

  const allRequiredReady = state === "READY";

  function handleStart() {
    if (!allRequiredReady) return;
    // Tear down only the metering graph — the mic track itself stays open and
    // is handed to the interview room, which is now the sole owner of it.
    stopMeter();
    onReady({
      videoStream: cameraStreamRef.current,
      audioStream: micStreamRef.current,
      screenStream: screenStreamRef.current,
    });
  }

  // ── Hard stop: unsupported browser / insecure context ────────────────────
  if (state === "BROWSER_UNSUPPORTED") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-rose-500/40 bg-void-dark p-8 space-y-4 text-center shadow-2xl">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
            <Ban size={28} />
          </div>
          <h1 className="text-xl font-bold text-signal">This Browser Can't Run the Live Interview</h1>
          <ul className="text-left text-xs text-rose-300 space-y-2 font-mono bg-rose-950/20 rounded-xl p-4 border border-rose-500/20">
            {browserIssues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-static">Please switch to the latest Chrome or Edge on desktop and reload this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border border-line-strong bg-void-dark p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-2 text-alert font-mono text-xs uppercase tracking-wider mb-1">
              <ShieldCheck size={14} />
              <span>Pre-Interview Verification Check</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-signal">Hardware & Environmental Readiness</h1>
            <p className="text-xs text-static font-mono mt-0.5">
              Target Role: <span className="text-signal font-semibold">{targetRole}</span> ({interviewType.toUpperCase()})
            </p>
          </div>

          <div className="rounded-xl border border-line-strong bg-surface px-3 py-1.5 font-mono text-xs text-static">
            Status:{" "}
            {state === "READY" ? (
              <span className="text-emerald-400 font-semibold">ALL CHECKS PASSED ✓</span>
            ) : state === "CHECKING" ? (
              <span className="text-amber-400">CHECKING DEVICES…</span>
            ) : (
              <span className="text-rose-400 font-semibold">ACTION REQUIRED</span>
            )}
          </div>
        </div>

        {hasAudioInputDevice === false && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300">
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">No microphone input device was detected on this system.</p>
          </div>
        )}

        {(cameraErrorMsg || micErrorMsg || screenErrorMsg) && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{cameraErrorMsg || micErrorMsg || screenErrorMsg}</p>
          </div>
        )}

        {/* 2-Column Device Previews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Candidate WebCam Preview */}
          <div className="rounded-xl border border-line-strong bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-signal">
                <Camera size={15} className="text-alert" />
                <span>1. Camera Stream</span>
              </div>
              {cameraGranted ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <CheckCircle2 size={13} /> Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestCamera}
                  className="flex items-center gap-1 rounded-md bg-alert/20 px-2 py-1 font-mono text-[10px] text-alert hover:bg-alert/30"
                >
                  <RefreshCw size={11} /> {cameraErrorMsg ? "Retry Camera" : "Enable Camera"}
                </button>
              )}
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-void border border-line-dim flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover transform -scale-x-100 ${!cameraGranted && "hidden"}`}
              />
              {!cameraGranted && (
                <div className="text-center p-4 text-xs text-static space-y-1">
                  <Camera size={24} className="mx-auto text-static-dim mb-2" />
                  <p>{cameraErrorMsg ?? "Allow camera permissions to preview video"}</p>
                </div>
              )}
            </div>
          </div>

          {/* Screen Share Preview */}
          <div className="rounded-xl border border-line-strong bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-signal">
                <Monitor size={15} className="text-alert" />
                <span>2. Screen Share Stream</span>
              </div>
              {screenGranted ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <CheckCircle2 size={13} /> Sharing
                </span>
              ) : (
                <button
                  type="button"
                  onClick={requestScreenShare}
                  className="rounded-md bg-alert px-3 py-1 font-mono text-[11px] font-semibold text-void hover:opacity-90 transition-opacity"
                >
                  Share Screen
                </button>
              )}
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-void border border-line-dim flex items-center justify-center">
              <video
                ref={screenRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-contain ${!screenGranted && "hidden"}`}
              />
              {!screenGranted && (
                <div className="text-center p-4 text-xs text-static space-y-2">
                  <Monitor size={24} className="mx-auto text-alert mb-1" />
                  <p className="font-semibold text-signal">Screen Sharing (Recommended)</p>
                  <p className="text-[11px] text-static">{screenErrorMsg ?? 'Click "Share Screen" above to share display or continue with camera & mic.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Microphone Meter */}
        <div className="rounded-xl border border-line-strong bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-signal">
              <Mic size={15} className="text-alert" />
              <span>3. Microphone Voice Activity Test</span>
            </div>
            <span className="font-mono text-xs text-static">
              {!micGranted ? "Microphone unlinked" : micHeardAudio ? "Voice detected" : "Audio input active — waiting for voice"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full bg-void overflow-hidden p-0.5 border border-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-alert to-rose-500 transition-all duration-75"
                style={{ width: `${Math.max(5, audioLevel)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-signal w-10 text-right">{audioLevel}%</span>
          </div>
          <p className="text-[11px] text-static font-mono">
            {micGranted && !micHeardAudio
              ? "Say something into your microphone to verify speech sensitivity."
              : micGranted
                ? "Microphone is receiving audio correctly."
                : micErrorMsg ?? "Grant microphone access to run this check."}
          </p>
          {!micGranted && (
            <button
              type="button"
              onClick={requestMic}
              className="flex items-center gap-1 rounded-md bg-alert/20 px-2 py-1 font-mono text-[10px] text-alert hover:bg-alert/30"
            >
              <RefreshCw size={11} /> Retry Microphone
            </button>
          )}
        </div>

        {/* Anti-Cheating & Policy Notice */}
        <div className="rounded-xl border border-line bg-void p-4 text-xs text-static space-y-1.5 leading-relaxed font-body">
          <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-amber-400">
            <AlertCircle size={14} />
            <span>Anti-Cheating Policy Notice</span>
          </div>
          <p>
            During this live session, our real-time proctoring sentinel monitors for tab switching, window defocus, and revoked screen sharing.
            You will receive official warnings for suspicious activity. Reaching <strong>3 warnings</strong> will automatically terminate the interview session.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={!allRequiredReady}
            className="flex items-center gap-2 rounded-xl bg-alert px-8 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-void hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            <span>Enter Live AI Interview Room</span>
            <ArrowRight size={15} />
          </button>
        </div>
        {!allRequiredReady && (
          <p className="text-right text-[11px] font-mono text-static-dim -mt-4">
            Camera and microphone are both required to start. Screen sharing is optional.
          </p>
        )}
      </div>
    </div>
  );
}