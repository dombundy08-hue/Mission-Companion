import { sb } from './supabase-sync';

// Each account's own auth.uid() doubles as its QR code — unique per person
// automatically, nothing to generate or persist locally, and it's what
// contact_leads' RLS checks against (auth.uid()::text = code) so only the
// owning account can see/manage leads submitted through their own code.
export async function getQrCode(): Promise<string> {
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? '';
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
