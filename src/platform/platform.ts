/**
 * Platform detection — the ONLY place that asks "are we inside Capacitor?".
 * Everywhere else uses these booleans for graceful web fallbacks.
 */
import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function platformName(): 'android' | 'web' {
  return isAndroid() ? 'android' : 'web';
}
