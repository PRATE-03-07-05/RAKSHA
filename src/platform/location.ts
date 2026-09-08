/**
 * Location with web-safe fallback. Permission is requested ONLY when this
 * function is called (never at app startup). Precise coordinates are
 * returned to the caller and never persisted by this module.
 */
import { Geolocation } from '@capacitor/geolocation';
import { isNative } from './platform';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

function browserLocation(timeoutMs: number): Promise<DeviceLocation> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission was denied.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Location request timed out. Try again outdoors.'));
        } else {
          reject(new Error('Could not determine your location.'));
        }
      },
      { timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

export async function getCurrentLocation(opts?: {
  timeoutMs?: number;
}): Promise<DeviceLocation> {
  const timeoutMs = opts?.timeoutMs ?? 10000;
  if (!isNative()) return browserLocation(timeoutMs);
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 60000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission|denied|not authorized/i.test(message)) {
      throw new Error('Location permission was denied. Enable it in Android Settings.');
    }
    if (/timeout/i.test(message)) {
      throw new Error('Location request timed out. Try again outdoors.');
    }
    throw new Error('Could not determine your location.');
  }
}
