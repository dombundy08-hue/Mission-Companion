// Ported directly from index.html — same localStorage key/JSON convention,
// so data shape stays compatible with the vanilla app.
export function getLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function setLS<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
