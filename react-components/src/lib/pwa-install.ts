// Detects whether this device would benefit from an "install this as an
// app" nudge — the site is built to be used as an installed PWA, not
// browsed as a regular website, but nothing tells a first-time phone
// visitor that.
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's older, non-standard flag — display-mode doesn't cover it.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isMobile(): boolean {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// Non-standard Chrome/Android/Edge event — no lib.dom.d.ts type exists for it.
interface BeforeInstallPromptEvent extends Event {
  prompt(): void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Fires before the browser's own install prompt would show — capturing it
// lets us trigger that same native prompt from our own "Install App"
// button instead of waiting for the browser's own UI (often buried in a
// menu). Registered at module load so it's caught even if it fires before
// any component using it has mounted.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function getInstallPrompt() {
  return deferredPrompt;
}

export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}
