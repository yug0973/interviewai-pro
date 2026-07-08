import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredAccessToken, getValidAccessToken } from "./api";
import type { RealtimeMessage } from "./api";

export type RealtimeConnectionState =
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "ERROR";

export type AIConversationState =
  | "INTRO"
  | "SPEAKING"
  | "LISTENING"
  | "THINKING"
  | "INTERRUPTED";

export type VADState =
  | "IDLE"
  | "LISTENING"
  | "SPEECH_DETECTED"
  | "CANDIDATE_SPEAKING"
  | "POSSIBLE_END_OF_TURN"
  | "TURN_FINALIZED";

export interface WarningAlert {
  active: boolean;
  warningNumber: number;
  maxWarnings: number;
  remainingWarnings: number;
  reason: string;
  severity: string;
}

interface UseRealtimeInterviewProps {
  sessionId: string;
  enabled: boolean;
  onInterviewComplete?: (sessionId: string) => void;
  onTerminated?: (reason: string) => void;
}

// Codes the server closes with deliberately (auth/session problems) — retrying
// a fresh connection can't fix these, so we surface ERROR immediately instead
// of burning through the reconnect budget.
const TERMINAL_CLOSE_CODES = new Set([4000, 4001, 4003, 4004]);

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;
const RECONNECT_MAX_ATTEMPTS = 8;

// End-of-turn tuning: a fixed silence timeout alone either cuts candidates off
// mid-thought (short timeout) or feels laggy (long timeout). We additionally
// require a minimum amount of active speaking time and a minimum word count
// before the SILENCE TIMER is allowed to auto-submit — this stops one-word
// filler ("um", "so") followed by a thinking pause from being submitted as
// the whole answer. The explicit "Done Speaking" button bypasses all of this
// intentionally, since an explicit user action should never be second-guessed.
const END_OF_TURN_SILENCE_MS = 3200;
const MIN_AUTO_SUBMIT_SPEAKING_MS = 900;
const MIN_AUTO_SUBMIT_WORDS = 2;

function makeCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Pick the best available TTS voice ────────────────────────────────────────
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const priority = [
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en") && v.name.includes("Microsoft") && v.name.includes("Neural"),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en") && v.name.includes("Microsoft") && (v.name.includes("Aria") || v.name.includes("Guy") || v.name.includes("Jenny") || v.name.includes("Ana")),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en") && v.name.includes("Microsoft"),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en") && v.name.includes("Google") && v.name.includes("US"),
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en") && (v.name.includes("Samantha") || v.name.includes("Karen")),
    (v: SpeechSynthesisVoice) => v.lang === "en-US",
    (v: SpeechSynthesisVoice) => v.lang.startsWith("en"),
  ];

  for (const test of priority) {
    const match = voices.find(test);
    if (match) return match;
  }
  return voices[0];
}

export function useRealtimeInterview({
  sessionId,
  enabled,
  onInterviewComplete,
  onTerminated,
}: UseRealtimeInterviewProps) {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>("DISCONNECTED");
  const [aiState, setAiState] = useState<AIConversationState>("INTRO");
  const [vadState, setVadState] = useState<VADState>("IDLE");
  const [liveTranscript, setLiveTranscript] = useState({ partial: "", final: "" });
  const [aiCurrentSpeech, setAiCurrentSpeech] = useState<string>("");
  const [currentTopic, setCurrentTopic] = useState<string>("Introduction");
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [maxWarnings, setMaxWarnings] = useState<number>(3);
  const [warningAlert, setWarningAlert] = useState<WarningAlert | null>(null);
  const [terminated, setTerminated] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [audioLevel] = useState<number>(0);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // ── Refs (never cause re-renders, always reflect current values) ─────────────
  const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const speechBufferRef = useRef<string>("");
  const speechStartedAtRef = useRef<number | null>(null);
  const aiStateRef = useRef<AIConversationState>("INTRO");
  const currentTopicRef = useRef<string>("Introduction");
  const terminatedRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);
  const enabledRef = useRef<boolean>(enabled);
  const shouldListenRef = useRef<boolean>(false);
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // The last candidate:speech_final we sent but haven't yet gotten an
  // ai:speech_start / interview:completed / interview:terminated response
  // for. If the socket drops before the response arrives, this is resent
  // (with the SAME correlationId) once we reconnect, so the turn is neither
  // lost nor — thanks to server-side dedupe — double-processed.
  const pendingFinalRef = useRef<{ correlationId: string; text: string } | null>(null);

  aiStateRef.current = aiState;
  currentTopicRef.current = currentTopic;
  terminatedRef.current = terminated;
  isCompletedRef.current = isCompleted;
  enabledRef.current = enabled;

  // ── Load best TTS voice (async — Chrome loads voices after page load) ─────────
  useEffect(() => {
    const load = () => {
      bestVoiceRef.current = getBestVoice();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Stop recognition cleanly ─────────────────────────────────────────────────
  const stopRecognition = useCallback(() => {
    shouldListenRef.current = false;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.abort(); } catch { /**/ }
      recognitionRef.current = null;
    }
  }, []);

  // ── Send text answer via WebSocket ───────────────────────────────────────────
  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    const correlationId = makeCorrelationId();
    pendingFinalRef.current = { correlationId, text: trimmed };
    socketRef.current.send(JSON.stringify({ type: "candidate:speech_final", text: trimmed, correlationId }));
    setAiState("THINKING");
    aiStateRef.current = "THINKING";
    setLiveTranscript({ partial: "", final: "" });
    speechBufferRef.current = "";
    speechStartedAtRef.current = null;
    setVadState("TURN_FINALIZED");
    setMessages((prev) => [
      ...prev,
      { id: `cand-${Date.now()}`, speaker: "CANDIDATE", text: trimmed, order: prev.length + 1, topic: currentTopicRef.current, createdAt: new Date().toISOString() },
    ]);
  }, []);

  // ── Finalize what's in the speech buffer (explicit — always honored) ────────
  const finalizeCandidateSpeech = useCallback(() => {
    const text = speechBufferRef.current.trim();
    speechBufferRef.current = "";
    speechStartedAtRef.current = null;
    setLiveTranscript({ partial: "", final: "" });
    if (!text) { setVadState("LISTENING"); return; }
    sendText(text);
  }, [sendText]);

  // ── Auto end-of-turn: same as finalizeCandidateSpeech but with minimum
  //    duration/word-count guards so a silence gap mid-answer or a stray
  //    filler word doesn't get auto-submitted as a whole answer. ───────────────
  const maybeAutoFinalize = useCallback(() => {
    const text = speechBufferRef.current.trim();
    const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const speakingMs = speechStartedAtRef.current ? Date.now() - speechStartedAtRef.current : 0;

    if (!text || wordCount < MIN_AUTO_SUBMIT_WORDS || speakingMs < MIN_AUTO_SUBMIT_SPEAKING_MS) {
      // Not enough to call it an answer yet — keep listening instead of
      // submitting a stray word. The candidate can still finish naturally,
      // or use "Done Speaking" to force it.
      setVadState("LISTENING");
      return;
    }
    finalizeCandidateSpeech();
  }, [finalizeCandidateSpeech]);

  // ── Start a fresh SpeechRecognition instance ─────────────────────────────────
  const startRecognition = useCallback(() => {
    if (terminatedRef.current || isCompletedRef.current) return;

    // Kill any existing instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.abort(); } catch { /**/ }
      recognitionRef.current = null;
    }

    const SpeechCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechCtor) {
      setRecognitionError("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    shouldListenRef.current = true;
    speechBufferRef.current = "";
    speechStartedAtRef.current = null;

    const recognition = new SpeechCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVadState("LISTENING");
      setRecognitionError(null);
    };

    recognition.onresult = (event: any) => {
      if (!shouldListenRef.current) return;
      if (aiStateRef.current === "SPEAKING" || aiStateRef.current === "THINKING") return;

      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }

      if (finalChunk) speechBufferRef.current = (speechBufferRef.current + " " + finalChunk).trim();

      if (interim.trim() || finalChunk.trim()) {
        if (!speechStartedAtRef.current) speechStartedAtRef.current = Date.now();
        setVadState("CANDIDATE_SPEAKING");
      }

      setLiveTranscript({ partial: interim, final: speechBufferRef.current });

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (speechBufferRef.current.length > 0) {
        setVadState("POSSIBLE_END_OF_TURN");
        silenceTimerRef.current = setTimeout(() => maybeAutoFinalize(), END_OF_TURN_SILENCE_MS);
      }
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        setRecognitionError("Microphone blocked. Please allow mic access in browser settings.");
        shouldListenRef.current = false;
      } else if (err === "audio-capture") {
        setRecognitionError("No microphone was found. Connect a microphone and retry.");
        shouldListenRef.current = false;
      } else if (err === "network") {
        setRecognitionError("Speech API network error. Check your internet, or use the text box below.");
        // Transient — let onend's restart logic try again.
      }
      // no-speech / aborted — benign, let onend handle restart
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (
        shouldListenRef.current &&
        !terminatedRef.current &&
        !isCompletedRef.current &&
        enabledRef.current &&
        aiStateRef.current !== "SPEAKING" &&
        aiStateRef.current !== "THINKING"
      ) {
        setTimeout(() => { if (shouldListenRef.current) startRecognition(); }, 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      shouldListenRef.current = false;
      setRecognitionError("Could not start microphone. Try refreshing.");
    }
  }, [maybeAutoFinalize]);

  // ── Speak AI response then restart listening ─────────────────────────────────
  const speakAIResponse = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) { setTimeout(() => startRecognition(), 500); return; }

    stopRecognition();
    window.speechSynthesis.cancel();

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.05;

      const voice = bestVoiceRef.current ?? getBestVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        setAiState("SPEAKING");
        aiStateRef.current = "SPEAKING";
      };

      const afterSpeak = () => {
        // If a barge-in already moved us off SPEAKING (candidate started
        // talking and triggerBargeIn() handled the transition + restart
        // itself), this callback is firing because we cancelled the
        // utterance — don't restart recognition a SECOND time on top of
        // the one triggerBargeIn already scheduled.
        if (aiStateRef.current !== "SPEAKING") return;
        setAiState("LISTENING");
        aiStateRef.current = "LISTENING";
        speechBufferRef.current = "";
        speechStartedAtRef.current = null;
        setLiveTranscript({ partial: "", final: "" });
        setTimeout(() => startRecognition(), 500);
      };

      utterance.onend = afterSpeak;
      utterance.onerror = afterSpeak;

      window.speechSynthesis.speak(utterance);

      const resumeHack = setInterval(() => {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        if (!window.speechSynthesis.speaking) clearInterval(resumeHack);
      }, 10000);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        bestVoiceRef.current = getBestVoice();
        speak();
      };
    } else {
      speak();
    }
  }, [stopRecognition, startRecognition]);

  // ── Barge-in: candidate interrupts AI ────────────────────────────────────────
  const triggerBargeIn = useCallback(() => {
    if (aiStateRef.current !== "SPEAKING") return;
    setAiState("LISTENING");
    aiStateRef.current = "LISTENING"; // set BEFORE cancel() so the cancelled
    // utterance's onerror/onend (afterSpeak) sees a non-SPEAKING state and
    // no-ops instead of scheduling a second, competing startRecognition().
    window.speechSynthesis.cancel();
    socketRef.current?.send(JSON.stringify({ type: "candidate:interrupt" }));
    setTimeout(() => startRecognition(), 300);
  }, [startRecognition]);

  // ── WebSocket — created once, reconnects itself on unexpected drops ─────────
  useEffect(() => {
    if (!enabled || !sessionId) return;
    let isMounted = true;

    const _startRecognition = startRecognition;
    const _speakAIResponse = speakAIResponse;
    const _stopRecognition = stopRecognition;

    function scheduleReconnect() {
      if (!isMounted || !enabledRef.current || terminatedRef.current || isCompletedRef.current) return;
      if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
        setConnectionState("ERROR");
        return;
      }
      setConnectionState("RECONNECTING");
      _stopRecognition(); // don't let the mic run against a dead socket
      const attempt = reconnectAttemptsRef.current++;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** attempt, RECONNECT_MAX_DELAY_MS);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    async function connect() {
      if (!isMounted) return;
      let ws: WebSocket | null = null;
      try {
        let token = getStoredAccessToken() ?? await getValidAccessToken();
        if (!token || !isMounted) { setConnectionState("ERROR"); return; }

        const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:4000/api/realtime/interview?sessionId=${sessionId}&token=${token}`;
        setConnectionState(reconnectAttemptsRef.current > 0 ? "RECONNECTING" : "CONNECTING");
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          if (!isMounted || socketRef.current !== ws) return;
          setConnectionState("CONNECTED");
          reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event) => {
          if (!isMounted || socketRef.current !== ws) return; // ignore a stale/replaced socket's late messages
          try {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
              case "server:ready":
                setWarningCount(msg.warningCount ?? 0);
                setMaxWarnings(msg.maxWarnings ?? 3);
                if (pendingFinalRef.current) {
                  // An answer never got acknowledged before the drop —
                  // resend it with the same correlationId. The server
                  // dedupes on that id, so this is safe even if the
                  // original send actually did land before we dropped.
                  socketRef.current?.send(JSON.stringify({
                    type: "candidate:speech_final",
                    text: pendingFinalRef.current.text,
                    correlationId: pendingFinalRef.current.correlationId,
                  }));
                } else if (aiStateRef.current !== "SPEAKING" && aiStateRef.current !== "THINKING") {
                  _startRecognition();
                }
                break;
              case "ai:state":
                setAiState(msg.state);
                aiStateRef.current = msg.state;
                break;
              case "ai:speech_start":
                pendingFinalRef.current = null;
                setAiCurrentSpeech(msg.text);
                if (msg.topic) { setCurrentTopic(msg.topic); currentTopicRef.current = msg.topic; }
                setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, speaker: "AI", text: msg.text, order: msg.order ?? prev.length + 1, topic: msg.topic, isFollowUp: msg.isFollowUp, createdAt: new Date().toISOString() }]);
                _speakAIResponse(msg.text);
                break;
              case "integrity:warning":
                setWarningCount(msg.warningNumber);
                setMaxWarnings(msg.maxWarnings);
                setWarningAlert({ active: true, warningNumber: msg.warningNumber, maxWarnings: msg.maxWarnings, remainingWarnings: msg.remainingWarnings, reason: msg.reason, severity: msg.severity });
                setTimeout(() => setWarningAlert((p) => p ? { ...p, active: false } : null), 6000);
                break;
              case "interview:terminated":
                pendingFinalRef.current = null;
                window.speechSynthesis.cancel();
                _stopRecognition();
                setTerminated(true); terminatedRef.current = true;
                setTerminationReason(msg.reason);
                if (onTerminated) onTerminated(msg.reason);
                break;
              case "interview:completed":
                pendingFinalRef.current = null;
                window.speechSynthesis.cancel();
                _stopRecognition();
                setIsCompleted(true); isCompletedRef.current = true;
                if (onInterviewComplete) onInterviewComplete(sessionId);
                break;
            }
          } catch { /* parse error */ }
        };

        ws.onclose = (e) => {
          if (!isMounted || socketRef.current !== ws) return;
          socketRef.current = null;

          if (e.code === 4008 || terminatedRef.current || isCompletedRef.current) {
            setConnectionState("DISCONNECTED");
            return;
          }
          if (TERMINAL_CLOSE_CODES.has(e.code)) {
            setConnectionState("ERROR");
            return;
          }
          scheduleReconnect();
        };

        ws.onerror = () => { /* onclose always follows onerror for WebSocket; reconnect handled there */ };
      } catch {
        if (isMounted) scheduleReconnect();
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      window.speechSynthesis.cancel();
      stopRecognition();
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled]);

  // ── Integrity event listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || connectionState !== "CONNECTED" || terminated || isCompleted) return;
    const onHide = () => document.visibilityState === "hidden" && socketRef.current?.send(JSON.stringify({ type: "candidate:integrity_event", eventType: "TAB_SWITCH", metadata: { timestamp: new Date().toISOString() } }));
    const onBlur = () => socketRef.current?.send(JSON.stringify({ type: "candidate:integrity_event", eventType: "WINDOW_BLUR", metadata: { timestamp: new Date().toISOString() } }));
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("blur", onBlur); };
  }, [connectionState, enabled, isCompleted, terminated]);

  // ── Trigger device-ready handshake ───────────────────────────────────────────
  const triggerDeviceReady = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "candidate:device_ready" }));
    }
  }, []);

  return {
    connectionState, aiState, vadState, liveTranscript, aiCurrentSpeech, currentTopic,
    messages, warningCount, maxWarnings, warningAlert, terminated, terminationReason,
    isCompleted, audioLevel, recognitionError,
    triggerDeviceReady, triggerBargeIn, finalizeCandidateSpeech, sendText, stopAISpeech: () => window.speechSynthesis.cancel(),
  };
}