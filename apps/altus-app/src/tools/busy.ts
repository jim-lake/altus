import { useState, useRef, useCallback } from 'react';

export default { useBusy };

export function useBusy(
  defaultValue = false
): [boolean, () => boolean, () => void, () => boolean] {
  const [isStateBusy, setIsStateBusy] = useState(defaultValue);
  const busyRef = useRef(defaultValue);

  const setBusy = useCallback(() => {
    if (!busyRef.current) {
      busyRef.current = true;
      setIsStateBusy(true);
      return true;
    }
    return false;
  }, []);

  const clearBusy = useCallback(() => {
    busyRef.current = false;
    setIsStateBusy(false);
  }, []);

  const isBusy = useCallback(() => busyRef.current, []);

  return [isStateBusy, setBusy, clearBusy, isBusy];
}
