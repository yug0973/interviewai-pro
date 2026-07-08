import { useCallback, useEffect, useRef, useState } from "react";

export type MicPermissionState = "prompt" | "granted" | "denied" | "unsupported";

interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  permission: MicPermissionState;
  transcript: string;
  interimTranscript: string;
  audioLevel: number;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [permission, setPermission] = useState<MicPermissionState>("prompt");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Refs mirroring state that the rAF loop and SpeechRecognition callbacks
  // need to read at CALL time, not at closure-creation time. `listening`
  // (the React state) used to be read directly inside the recursive
  // requestAnimationFrame loop via a useCallback — but that callback's
  // closure was captured the instant startAudioAnalyzer() ran, which is
  // BEFORE setListening(true) commits. The loop read a permanently-stale
  // `false` and died after a single frame, every time. Refs fix that: they
  // always reflect the current value regardless of when the closure that
  // reads them was created.
  const listeningRef = useRef(false);
  const shouldListenRef = useRef(false);
  const startingRef = useRef(false);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
      : undefined;

  // Check microphone permissions
  useEffect(() => {
    if (!SpeechRecognitionCtor) {
      setPermission("unsupported");
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          setPermission(status.state as MicPermissionState);
          status.onchange = () => setPermission(status.state as MicPermissionState);
        })
        .catch(() => {
          // Some browsers (Safari, older Firefox) don't support querying
          // the microphone permission descriptor. We simply fall back to
          // "prompt" and let getUserMedia's own result decide.
        });
    }
  }, [SpeechRecognitionCtor]);

  const stopAudioAnalyzer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      stopAudioAnalyzer();
    };
  }, [stopAudioAnalyzer]);

  const runMeterLoop = useCallback(() => {
    if (!analyserRef.current || !listeningRef.current) return; // stop cleanly, don't zero-and-die

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = sum / dataArray.length;
    setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

    animFrameRef.current = requestAnimationFrame(runMeterLoop);
  }, []);

  const startAudioAnalyzer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    setPermission("granted");

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextCtor();
    audioContextRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
  };

  const start = useCallback(async () => {
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    // Guard against double-start from rapid double-clicks — without this,
    // two overlapping getUserMedia + SpeechRecognition instances could be
    // spun up concurrently, each fighting the other for the microphone.
    if (startingRef.current || listeningRef.current) return;
    startingRef.current = true;

    setError(null);

    try {
      await startAudioAnalyzer();

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        listeningRef.current = true;
        shouldListenRef.current = true;
        startingRef.current = false;
        setListening(true);
        // (Re)arm the meter loop now that listeningRef is actually true.
        runMeterLoop();
      };

      recognition.onresult = (event: any) => {
        let final = "";
        let interim = "";

        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) {
            final += res[0].transcript + " ";
          } else {
            interim += res[0].transcript;
          }
        }

        if (final) {
          setTranscript((prev) => (prev ? `${prev.trim()} ${final.trim()}` : final.trim()));
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setPermission("denied");
          setError("Microphone permission was denied.");
          shouldListenRef.current = false;
        } else if (event.error === "audio-capture") {
          setError("No microphone was found. Connect a microphone and retry.");
          shouldListenRef.current = false;
        } else if (event.error === "network") {
          setError(
            "Browser voice recognition network error (often caused by Brave privacy shields or ad-blockers blocking Google Speech API). You can type your response below or retry."
          );
          // Network errors are frequently transient — let onend's restart logic try again.
        } else if (event.error === "no-speech" || event.error === "aborted") {
          // Benign — the mic just heard silence for too long, or we aborted
          // it ourselves. onend fires right after this and decides whether
          // to transparently restart; don't surface this as a user-facing error.
        } else {
          setError(`Voice recognition issue: ${event.error}`);
        }
      };

      recognition.onend = () => {
        listeningRef.current = false;
        recognitionRef.current = null;

        if (shouldListenRef.current) {
          // Candidate never pressed "stop" — this was a benign browser-side
          // timeout (e.g. no-speech after a long pause). Restart seamlessly
          // instead of stranding the candidate on a dead mic icon.
          setTimeout(() => {
            if (shouldListenRef.current) start();
          }, 300);
        } else {
          setListening(false);
          stopAudioAnalyzer();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      startingRef.current = false;
      shouldListenRef.current = false;
      listeningRef.current = false;
      setError(err instanceof Error ? err.message : "Failed to start speech recognition.");
      setListening(false);
      setPermission((p) => (p === "granted" ? p : "denied"));
      stopAudioAnalyzer();
    }
  }, [SpeechRecognitionCtor, runMeterLoop, stopAudioAnalyzer]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    listeningRef.current = false;
    setListening(false);
    stopAudioAnalyzer();
  }, [stopAudioAnalyzer]);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    supported: Boolean(SpeechRecognitionCtor),
    listening,
    permission,
    transcript,
    interimTranscript,
    audioLevel,
    start,
    stop,
    reset,
    error,
  };
}