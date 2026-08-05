import { sb } from './supabase-sync';

// Real Supabase Auth — replaces the old single hardcoded APP_PASSWORD.
// Thin wrappers only; AuthContext.tsx owns the session state itself via
// sb.auth.getSession()/onAuthStateChange().
export async function signUp(email: string, password: string, displayName: string) {
  // display_name lands in auth.users.raw_user_meta_data immediately, even
  // before email confirmation — the profiles-row trigger reads it from
  // there, since there's no session yet to run a follow-up update with.
  return sb.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
}

export async function signIn(email: string, password: string) {
  return sb.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return sb.auth.signOut();
}

// Soft cap on total accounts — a determined person could race two signups
// past this, which is an acceptable edge case for a ~5-person personal app.
// A hard reject would require a trigger on Supabase's own auth.users table,
// more risk than the benefit is worth at this trust level.
export const MAX_ACCOUNTS = 5;

export async function accountCount(): Promise<number> {
  const res = await sb.from('profiles').select('*', { count: 'exact', head: true });
  return res.count ?? 0;
}
