// Update detection for the static GH Pages deploy. Vite gives each build a
// unique hashed bundle filename (index-XXXX.js) — comparing the hash the
// currently-running page loaded against the hash in the live index.html is
// a reliable "is there a newer deploy" signal, with no extra build config
// or version.json needed. No-ops harmlessly in dev (no hashed assets there).
function extractHash(html: string): string | null {
  const m = html.match(/\/assets\/index-([\w-]+)\.js/);
  return m ? m[1] : null;
}

export function currentBuildHash(): string | null {
  const script = document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null;
  return script ? extractHash(script.src) : null;
}

// Tracks the last few build hashes this device has actually run, purely for
// visibility in Settings. True instant rollback isn't possible for a static
// GitHub Pages deploy without redeploying an older commit — there's no
// server to flip a switch on — so this is deliberately just a record, not
// a working "restore" button that would overclaim what it can do.
interface BuildRecord {
  hash: string;
  firstSeen: string;
}
export function recordCurrentBuild() {
  const hash = currentBuildHash();
  if (!hash) return;
  const raw = localStorage.getItem('buildHistory');
  let history: BuildRecord[] = [];
  try {
    history = raw ? JSON.parse(raw) : [];
  } catch {
    history = [];
  }
  if (history[0]?.hash === hash) return;
  history = [{ hash, firstSeen: new Date().toISOString() }, ...history].slice(0, 5);
  localStorage.setItem('buildHistory', JSON.stringify(history));
}
export function getBuildHistory(): BuildRecord[] {
  try {
    return JSON.parse(localStorage.getItem('buildHistory') || '[]');
  } catch {
    return [];
  }
}

export async function checkForUpdate(): Promise<boolean> {
  const current = currentBuildHash();
  if (!current) return false; // dev mode, or already up to date with no way to compare
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'index.html', { cache: 'no-store' });
    if (!res.ok) return false;
    const remote = extractHash(await res.text());
    return !!remote && remote !== current;
  } catch {
    return false;
  }
}
