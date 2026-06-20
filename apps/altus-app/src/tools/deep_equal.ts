export function deepEqual(x: unknown, y: unknown) {
  if (x === y) {
    return true;
  } else if (x === null || y === null) {
    return false;
  } else {
    if (typeof x === 'object' && typeof y === 'object') {
      for (const p in x) {
        if (Object.prototype.hasOwnProperty.call(x, p)) {
          if (!Object.prototype.hasOwnProperty.call(y, p)) {
            return false;
          } else if (
            !deepEqual(
              (x as Record<string, unknown>)[p],
              (y as Record<string, unknown>)[p]
            )
          ) {
            return false;
          }
        }
      }

      for (const p in y) {
        if (
          Object.prototype.hasOwnProperty.call(y, p) &&
          !Object.prototype.hasOwnProperty.call(x, p)
        ) {
          return false;
        }
      }
    } else {
      return false;
    }
    return true;
  }
}
