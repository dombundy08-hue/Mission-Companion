// Theme storage/application. Same localStorage key/value convention as the
// vanilla app ('theme' = 'dark' | 'light'), but applies a `.dark` class
// instead of vanilla's `data-theme` attribute — index.css's Tailwind v4
// `@custom-variant dark` is keyed off the class, not the attribute.
const STORAGE_KEY = 'theme';

function storedPreference(): boolean | null {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'dark') return true;
  if (v === 'light') return false;
  return null;
}

export function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
}

export function isDarkModeOn(): boolean {
  return document.documentElement.classList.contains('dark');
}

// Called once at boot, before first paint, so there's no light->dark flash.
export function initTheme() {
  const stored = storedPreference();
  const dark = stored === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : stored;
  document.documentElement.classList.toggle('dark', dark);
}
