/**
 * Photo capture with web-safe fallback.
 *
 * - Android/native: Capacitor Camera (native camera or gallery), with
 *   explicit handling for cancellation, denied permissions and corrupt data.
 * - Web: normal <input type="file" accept="image/*"> picker.
 *
 * Returns a JPEG data URL, or null when the user cancels. Throws Error with
 * a user-friendly message for denied permissions / failures. Never logs
 * image content.
 */
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNative } from './platform';

export interface PhotoResult {
  dataUrl: string;
  format: string;
}

function pickViaFileInput(): Promise<PhotoResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      if (!file.type.startsWith('image/')) {
        reject(new Error('Selected file is not an image.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve({ dataUrl: reader.result, format: file.type })
          : reject(new Error('Could not read the selected image.'));
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function takePhoto(opts?: {
  fromGallery?: boolean;
}): Promise<PhotoResult | null> {
  if (!isNative()) return pickViaFileInput();
  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: opts?.fromGallery ? CameraSource.Photos : CameraSource.Prompt,
    });
    if (!photo.dataUrl) throw new Error('Camera returned no image data.');
    return { dataUrl: photo.dataUrl, format: `image/${photo.format ?? 'jpeg'}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Capacitor surfaces user cancellation as an error — map it to null.
    if (/cancel|cancelled|dismissed|no image picked/i.test(message)) return null;
    if (/permission|denied|not authorized/i.test(message)) {
      throw new Error('Camera permission was denied. Enable it in Android Settings to take photos.');
    }
    throw new Error('Could not capture a photo. Try again or choose an existing image.');
  }
}
