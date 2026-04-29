/**
 * Parse common critical-limit text from HACCP CCPs and check if a measured value is in range.
 * Returns null if inputs are missing or the limit string cannot be parsed.
 */
export function evaluateCriticalLimit(
  limitText: string | null | undefined,
  value: number | null | undefined,
): boolean | null {
  if (limitText == null || limitText === "" || value == null || Number.isNaN(value)) {
    return null;
  }

  const t = limitText.trim();

  const between = t.match(
    /between\s+(-?\d+(?:\.\d+)?)\s+and\s+(-?\d+(?:\.\d+)?)/i,
  );
  if (between) {
    const low = parseFloat(between[1]);
    const high = parseFloat(between[2]);
    const lo = Math.min(low, high);
    const hi = Math.max(low, high);
    return value >= lo && value <= hi;
  }

  const gteAll = [...t.matchAll(/>=\s*(-?\d+(?:\.\d+)?)/g)];
  const lteAll = [...t.matchAll(/<=\s*(-?\d+(?:\.\d+)?)/g)];
  if (gteAll.length > 0 && lteAll.length > 0) {
    const low = Math.max(...gteAll.map((m) => parseFloat(m[1])));
    const high = Math.min(...lteAll.map((m) => parseFloat(m[1])));
    return value >= low && value <= high;
  }
  if (gteAll.length === 1) {
    return value >= parseFloat(gteAll[0][1]);
  }
  if (lteAll.length === 1) {
    return value <= parseFloat(lteAll[0][1]);
  }

  const dashRange = t.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (dashRange) {
    let low = parseFloat(dashRange[1]);
    let high = parseFloat(dashRange[2]);
    if (low > high) {
      const tmp = low;
      low = high;
      high = tmp;
    }
    return value >= low && value <= high;
  }

  return null;
}
