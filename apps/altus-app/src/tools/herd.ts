export type HerdFunction<T extends unknown[], S, A extends boolean> = ((
  ...args: T
) => Promise<S>) &
  (A extends true
    ? { isRunning: (...args: T) => Promise<boolean> }
    : { isRunning: (...args: T) => boolean });

export function herd<T extends unknown[], S>(
  func: (...args: T) => Promise<S>,
  tagFunc: (...args: T) => string
): HerdFunction<T, S, false>;
export function herd<T extends unknown[], S>(
  func: (...args: T) => Promise<S>,
  tagFunc?: (...args: T) => Promise<string>
): HerdFunction<T, S, true>;
export function herd<T extends unknown[], S>(
  func: (...args: T) => Promise<S>,
  tagFunc?: (...args: T) => Promise<string> | string
): HerdFunction<T, S, boolean> {
  const promise_map = new Map<string, Promise<S>>();
  async function wrapped(...args: T) {
    const key = (await tagFunc?.(...args)) ?? '';
    let promise = promise_map.get(key);
    if (promise) {
      return promise;
    } else {
      promise = func(...args);
      promise_map.set(key, promise);
      try {
        return await promise;
      } finally {
        promise_map.delete(key);
      }
    }
  }
  wrapped.isRunning = (...args: T): Promise<boolean> | boolean => {
    const key_p = tagFunc?.(...args) ?? '';
    if (key_p instanceof Promise) {
      return key_p.then((key) => promise_map.has(key));
    } else {
      return promise_map.has(key_p);
    }
  };
  return wrapped as HerdFunction<T, S, boolean>;
}
export function herdOnce<T extends unknown[], S>(
  func: (...args: T) => Promise<S>
): (...args: T) => Promise<S> {
  let promise: Promise<S> | undefined;
  async function wrapped(...args: T): Promise<S> {
    promise ??= func(...args);
    return promise;
  }
  return wrapped;
}
