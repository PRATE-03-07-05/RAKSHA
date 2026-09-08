/**
 * Android shell initialisation — called once from main.tsx, no-op on web.
 *
 * - Status bar: brand colour, non-overlay (content never hides under it).
 * - Hardware back button: pop in-app history when possible; otherwise let
 *   the OS handle it. Never logs out or destroys state.
 * - Splash screen: hidden after the React tree mounts.
 * - Service worker: left unregistered on native (Capacitor serves the
 *   bundled assets; the web SW cache would only add staleness risk).
 */
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './platform';
import { hydrateTokenFromNativeStore } from './token';

export function shouldRegisterServiceWorker(): boolean {
  return !isNative();
}

export async function initAndroidShell(): Promise<void> {
  if (!isNative()) return;
  // Restore session before first render where possible.
  await hydrateTokenFromNativeStore();
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0F3D33' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* cosmetic — ignore */
  }
  try {
    // Back-button: go back inside RAKSHA when history exists.
    await CapApp.addListener('backButton', () => {
      if (window.history.length > 1) window.history.back();
      else CapApp.exitApp().catch(() => undefined);
    });
  } catch {
    /* listener unavailable — default OS behaviour applies */
  }
  try {
    await SplashScreen.hide();
  } catch {
    /* splash auto-hides per capacitor.config.ts */
  }
}
