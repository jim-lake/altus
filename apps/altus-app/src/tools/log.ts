export default {
  setDebugLogger,
  setLoggingEnabled,
  log,
  errorLog,
  errorQuietLog,
  debugLog,
};

export type Logger = (...args: unknown[]) => void;
let g_logger: Logger | null = null;
let g_enabled =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem('xvg-enableLogging') !== 'false';

export function setDebugLogger(logger: Logger) {
  g_logger = logger;
}
export function setLoggingEnabled(enabled: boolean) {
  g_enabled = enabled;
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
export function debugLog(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
  if (g_logger) {
    g_logger(...args);
  }
}
