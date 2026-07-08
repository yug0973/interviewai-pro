export {}

interface SpeechRecognitionResultLike {
  transcript: string
}

interface SpeechRecognitionEventLike extends Event {
  results: {
    [index: number]: {
      [index: number]: SpeechRecognitionResultLike
      isFinal: boolean
    }
    length: number
  }
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}
