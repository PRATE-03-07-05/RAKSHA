/**
 * Session-token storage with identical behaviour on web and Android.
 *
 * - Web: localStorage (unchanged from the original implementation).
 * - Android: Capacitor Preferences (sandboxed app storage) + localStorage
 *   mirror, so the existing synchronous getToken() keeps working and the
 *   web app is unaffected.
 *
 * NOTE: Preferences is sandboxed but NOT encrypted. For release hardening,
 * consider @capacitor/secure-storage-plugin for the JWT. See docs/ANDROID.md.
 */
import { Preferences } from '@capacitor/preferences';
import { isNative } from './platform';

export const TOKEN_KEY = 'raksha.session.v1';
const PREF_KEY = 'raksha.session';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function hydrateTokenFromNativeStore(): Promise<void> {
  if (!isNative()) return;
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (value) {
      try {
        localStorage.setItem(TOKEN_KEY, value);
      } catch {
        /* storage unavailable */
      }
    }
  } catch {
    /* native store unavailable — localStorage remains the source of truth */
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — session simply won't persist */
  }
  if (isNative()) {
    // Fire-and-forget mirror; localStorage is authoritative for reads.
    if (token) Preferences.set({ key: PREF_KEY, value: token }).catch(() => undefined);
    else Preferences.remove({ key: PREF_KEY }).catch(() => undefined);
  }
}
