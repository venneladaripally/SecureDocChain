// Browsers can't directly "save" a Blob from JS - the standard trick
// is to create a temporary invisible link pointing at the blob's data,
// click it programmatically, then clean up. This is the same pattern
// used by virtually every JS file-download implementation.
export function triggerBrowserDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url); // free the memory the browser allocated
}