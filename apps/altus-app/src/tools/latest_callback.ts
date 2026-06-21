import { useCallback, useRef } from 'react';

type Handler<T extends unknown[], U> = (...args: T) => U;

export function useLatestCallback<T extends unknown[], U>(
  handler: Handler<T, U>
): Handler<T, U> {
  const handlerRef = useRef<Handler<T, U>>(handler);
  // eslint-disable-next-line react-hooks/refs
  handlerRef.current = handler;

  return useCallback((...args: T) => {
    return handlerRef.current(...args);
  }, []);
}
