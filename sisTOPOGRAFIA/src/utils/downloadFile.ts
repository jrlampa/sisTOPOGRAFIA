/**
 * Utility to trigger a file download in the browser.
 * Creates a temporary anchor element, clicks it, then cleans up.
 */
export function downloadFile(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Triggers a download for a Blob, automatically revoking the object URL after.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadFile(url, filename);
  URL.revokeObjectURL(url);
}
