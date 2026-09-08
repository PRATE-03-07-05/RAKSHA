/**
 * File selection for medical documents / reports / images.
 *
 * The Android WebView file picker handles selection natively, so this is a
 * thin unified helper: opens the picker, validates type + size, and hands
 * the File to the EXISTING upload API. No silent uploads — the caller
 * decides what to do with the returned File.
 */
export interface PickFileOptions {
  /** e.g. "image/*,.pdf". Defaults to common medical-doc types. */
  accept?: string;
  /** Max size in bytes. Defaults to 10 MB. */
  maxBytes?: number;
}

const DEFAULT_ACCEPT = 'image/*,.pdf,.doc,.docx,.txt';
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export function pickFile(opts?: PickFileOptions): Promise<File | null> {
  const accept = opts?.accept ?? DEFAULT_ACCEPT;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      if (file.size > maxBytes) {
        reject(
          new Error(
            `File is too large (${(file.size / 1048576).toFixed(1)} MB). Maximum is ${(maxBytes / 1048576).toFixed(0)} MB.`,
          ),
        );
        return;
      }
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
