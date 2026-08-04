// Single source of truth for the app password + authenticated flag.
// Not real security — client-side app, same trust model as the vanilla
// app's hardcoded APP_PASSWORD — just a casual gate + a reveal-lock for
// the API keys panel in Settings.
export const APP_PASSWORD = 'steely08!';

export function isAuthenticated(): boolean {
  return localStorage.getItem('authenticated') === 'true';
}

export function setAuthenticated(value: boolean) {
  localStorage.setItem('authenticated', value ? 'true' : 'false');
}
