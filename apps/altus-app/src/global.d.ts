// Globals available in React Native (Hermes) but not in the default TS lib
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  decode(input?: ArrayBuffer | Uint8Array): string;
}

// Hermes provides performance.now()
declare const performance: { now: () => number };
