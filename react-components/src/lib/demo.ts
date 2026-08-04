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

// Per-feature AI call cap in Demo Mode — so a demo session can't be used to
// spam calls against the real API key. Resets naturally each demo session
// since Demo Mode wipes localStorage on both entry and exit.
export const DEMO_CALL_LIMIT = 5;
export type DemoLimitedFeature = 'objections' | 'spanish';

export const DEMO_LIMIT_MESSAGE = "You've reached the Demo Mode limit for this feature. Create a real account to keep going.";

function demoUsageKey(feature: DemoLimitedFeature): string {
  return `demoUsage_${feature}`;
}
export function getDemoUsage(feature: DemoLimitedFeature): number {
  return parseInt(localStorage.getItem(demoUsageKey(feature)) || '0', 10) || 0;
}
export function demoLimitReached(feature: DemoLimitedFeature): boolean {
  return isDemoMode() && getDemoUsage(feature) >= DEMO_CALL_LIMIT;
}
export function incrementDemoUsage(feature: DemoLimitedFeature) {
  localStorage.setItem(demoUsageKey(feature), String(getDemoUsage(feature) + 1));
}

// Clears every localStorage key on this device (journal, health, scripture
// progress, settings, demoMode itself) and reloads to a clean first-run
// state. Local-device only — never touches the Supabase cloud backup.
export function wipeLocalData() {
  localStorage.clear();
  location.reload();
}
