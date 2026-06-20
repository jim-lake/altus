export interface RetryParams {
  times?: number;
  interval?: (count: number) => number;
  signal?: AbortSignal;
}
export async function retry<T>(
  func: (signal?: AbortSignal) => Promise<T>,
  params?: RetryParams
): Promise<T> {
  const times = params?.times ?? 5;
  const interval = params?.interval ?? _defaultInterval;
  const signal = params?.signal;

  if (signal?.aborted) {
    throw new Error('Operation aborted');
  }
  let count = 0;
  for (;;) {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }
    try {
      return await func(signal);
    } catch (err) {
      if (++count >= times) {
        throw err;
      }
      await _delay(interval(count), signal);
    }
  }
}
const MAX_RETRY_INTERVAL = 60 * 1000;
function _defaultInterval(count: number): number {
  const base = Math.min(50 * Math.pow(3, count), MAX_RETRY_INTERVAL);
  return base + Math.floor(Math.random() * 20);
}

async function _delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      reject(new Error('Operation aborted'));
    }

    if (signal?.aborted) {
      clearTimeout(timeout);
      reject(new Error('Operation aborted'));
    } else if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}
