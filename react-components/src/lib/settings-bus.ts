import { useEffect } from 'react';

// Lightweight pub/sub so a screen mounted behind the Settings overlay can
// react immediately when a setting changes, instead of only picking up the
// new value the next time it mounts (e.g. after navigating away and back).
// Not a Supabase/network thing — purely a same-tab, same-page notification.
const EVENT = 'mc:settings-changed';

export function notifySettingsChanged() {
  window.dispatchEvent(new Event(EVENT));
}

export function useSettingsChanged(callback: () => void) {
  useEffect(() => {
    window.addEventListener(EVENT, callback);
    return () => window.removeEventListener(EVENT, callback);
  }, [callback]);
}
