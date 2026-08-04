// Demo Mode — a local-only mode for showing the app to someone else, or for
// stress-testing without touching Dom's real data. No API keys, no cloud
// sync; everything wipes on logout so the next person starts fresh.
export function isDemoMode(): boolean {
  return localStorage.getItem('demoMode') === 'true';
}

export function setDemoMode(value: boolean) {
  if (value) localStorage.setItem('demoMode', 'true');
  else localStorage.removeItem('demoMode');
}

export const DEMO_AI_MESSAGE = "AI features aren't available in Demo Mode.";

// Clears every localStorage key on this device (journal, health, scripture
// progress, settings, demoMode itself) and reloads to a clean first-run
// state. Local-device only — never touches the Supabase cloud backup.
export function wipeLocalData() {
  localStorage.clear();
  location.reload();
}
