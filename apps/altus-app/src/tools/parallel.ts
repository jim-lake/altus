export function parallel<T extends ReadonlyArray<() => Promise<unknown>>>(
  ...funcs: T
): Promise<{ [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }>;
export function parallel<T extends ReadonlyArray<() => Promise<unknown>>>(
  funcs: T
): Promise<{ [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }>;
export function parallel<T extends ReadonlyArray<() => Promise<unknown>>>(
  ...args: [T] | T
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const funcs = Array.isArray(args[0]) ? args[0] : args;
  const funcsArray = funcs as ReadonlyArray<T[number]>;
  const promises = funcsArray.map((fn) => fn());
  return Promise.all(promises) as Promise<{
    [K in keyof T]: Awaited<ReturnType<T[K]>>;
  }>;
}
