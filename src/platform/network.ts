/**
 * Connectivity watcher. On Android it uses the Capacitor Network plugin;
 * on web it falls back to navigator.onLine + online/offline events.
 * The callback receives `true` when the device believes it is online.
 * RAKSHA's existing offline queue + ApiError(0) handling stays authoritative.
 */
import { Network } from '@capacitor/network';
import { isNative } from './platform';

export function watchConnectivity(cb: (online: boolean) => void): () => void {
  if (!isNative()) {
    const emit = () => cb(navigator.onLine);
    window.addEventListener('online', emit);
    window.addEventListener('offline', emit);
    return () => {
      window.removeEventListener('online', emit);
      window.removeEventListener('offline', emit);
    };
  }
  let remove: (() => void) | undefined;
  Network.getStatus()
    .then((s) => cb(s.connected))
    .catch(() => undefined);
  Network.addListener('networkStatusChange', (s) => cb(s.connected)).then(
    (h) => {
      remove = () => {
        h.remove().catch(() => undefined);
      };
    },
  );
  return () => remove?.();
}
