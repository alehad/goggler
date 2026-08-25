export interface SpeechRecognitionAlternative {
  transcript: string;
}

export interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

export interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/**
 * The only place that knows there are two possible global names for this
 * constructor (unprefixed vs WebKit-prefixed) — every caller just gets back
 * "the constructor, or undefined if this browser doesn't support it."
 */
export function getSpeechRecognitionConstructor(
  win: (Window & typeof globalThis) | undefined
): SpeechRecognitionConstructor | undefined {
  return win?.SpeechRecognition ?? win?.webkitSpeechRecognition;
}
