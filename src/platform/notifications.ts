/**
 * Push notifications (Android only; no-op on web).
 *
 * Client-side wiring only: permission → FCM token → listeners. The token is
 * handed to the caller for registration against the EXISTING backend.
 * RAKSHA's backend currently serves in-app notifications by polling; there
 * is NO server-side push sender yet — see docs/ANDROID.md for the required
 * FCM architecture before enabling this in production. Never log tokens.
 */
import { PushNotifications } from '@capacitor/push-notifications';
import { isNative } from './platform';

export interface PushInit {
  /** FCM registration token — send to your backend over HTTPS. */
  token: string;
}

export async function initPushNotifications(opts: {
  onToken: (t: PushInit) => void;
  /** Deep-link path (e.g. "/app/referrals/123") when a notification is tapped. */
  onTap?: (path: string | null) => void;
  onError?: (message: string) => void;
}): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await PushNotifications.register();

    PushNotifications.addListener('registration', (t) => opts.onToken({ token: t.value }));
    PushNotifications.addListener('registrationError', (e) =>
      opts.onError?.('Push registration failed.'),
    );
    // Foreground notifications: RAKSHA already surfaces in-app alerts by
    // polling; keep the OS banner quiet to avoid double-notifying.
    PushNotifications.addListener('pushNotificationReceived', () => undefined);
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const link =
        (action.notification.data?.link as string | undefined) ??
        (action.notification.data?.path as string | undefined) ??
        null;
      opts.onTap?.(link);
    });
    return true;
  } catch {
    opts.onError?.('Push notifications are unavailable on this device.');
    return false;
  }
}
