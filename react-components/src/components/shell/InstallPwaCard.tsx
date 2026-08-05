import { useEffect, useState } from 'react';
import { isStandalone, isMobile, isIOS, getInstallPrompt, triggerInstallPrompt } from '@/lib/pwa-install';

const DISMISS_KEY = 'installPwaDismissed';

// This app is built to be used as an installed PWA, not browsed as a
// regular website — shown on LockScreen since that's the one screen
// every visitor hits first, logged in or not, new account or returning.
export function InstallPwaCard() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');
  const [canPrompt, setCanPrompt] = useState(() => !!getInstallPrompt());
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPromptReady = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', onPromptReady);
    return () => window.removeEventListener('beforeinstallprompt', onPromptReady);
  }, []);

  if (dismissed || installed || isStandalone() || !isMobile()) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  }

  async function install() {
    const accepted = await triggerInstallPrompt();
    if (accepted) setInstalled(true);
  }

  return (
    <div className="mt-6 rounded-xl p-4 text-left" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-sm font-bold text-white">📲 Install this as an app</span>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-lg leading-none text-white/60">
          ✕
        </button>
      </div>
      {isIOS() ? (
        <p className="text-[13px] leading-snug text-white/80">
          This works best installed on your home screen. Tap the <b>Share</b> icon (⬆️ in Safari's toolbar), then <b>"Add to Home Screen."</b>
        </p>
      ) : canPrompt ? (
        <>
          <p className="mb-2.5 text-[13px] leading-snug text-white/80">
            This works best installed on your home screen — full screen, works offline, no browser bar.
          </p>
          <button
            type="button"
            onClick={install}
            className="w-full rounded-lg py-2.5 text-sm font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            Install App
          </button>
        </>
      ) : (
        <p className="text-[13px] leading-snug text-white/80">
          This works best installed on your home screen. Open your browser's menu and look for <b>"Add to Home Screen"</b> or <b>"Install App."</b>
        </p>
      )}
    </div>
  );
}
