export default {
  setDebugLogger,
  setLoggingEnabled,
  log,
  errorLog,
  errorQuietLog,
  traceLog,
  debugLog,
};

export type Logger = (...args: unknown[]) => void;
let g_logger: Logger | null = null;
let g_enabled = true;
let g_traceEnabled = true;

export function setDebugLogger(logger: Logger) {
  g_logger = logger;
}
export function setLoggingEnabled(enabled: boolean) {
  g_enabled = enabled;
}
export function setTraceLoggingEnabled(enabled: boolean) {
  g_traceEnabled = enabled;
}
export function log(...args: unknown[]) {
  if (!g_enabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
}
export function errorLog(...args: unknown[]) {
  if (!g_enabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
  if (g_logger) {
    g_logger(...args);
  }
}
export function errorQuietLog(...args: unknown[]) {
  if (!g_enabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
  if (g_logger) {
    g_logger(...args);
  }
}
export function traceLog(...args: unknown[]) {
  if (!g_enabled || !g_traceEnabled) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(...args);
  if (g_logger) {
    g_logger(...args);
  }
}
export function debugLog(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
  if (g_logger) {
    g_logger(...args);
  }
}
