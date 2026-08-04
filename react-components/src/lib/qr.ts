import { uid } from './storage';
import { cloudSaveSetting } from './supabase-sync';

// A stable per-device code identifying this missionary's QR share link.
// Generated once and cloud-synced so it survives a fresh install.
export function getQrCode(): string {
  let code = localStorage.getItem('qrCode');
  if (!code) {
    code = uid();
    localStorage.setItem('qrCode', code);
    cloudSaveSetting('qrCode', code);
  }
  return code;
}

// Plain path, not a hash route — this app uses BrowserRouter with the
// existing 404.html-as-fallback trick (see repo root) so direct-navigated
// deep links like this one already resolve correctly in production.
export function contactShareUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}contact/${code}`;
}

// Public QR-image generation service — no client-side QR encoding library
// needed. Works for any URL, any phone's camera app.
export function qrImageUrl(data: string, size = 260): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
