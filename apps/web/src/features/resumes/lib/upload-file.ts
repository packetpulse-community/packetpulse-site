// The browser sends the file straight to storage (the signed URL), not through our server. XHR is
// used because fetch cannot report upload progress.
export class UploadFailedError extends Error {}
export class UploadAbortedError extends Error {}

export function putFile(url: string, file: File, contentType: string, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (onProgress(100), resolve()) : reject(new UploadFailedError(`storage answered ${xhr.status}`)));
    xhr.onerror = () => reject(new UploadFailedError("network error"));
    xhr.onabort = () => reject(new UploadAbortedError("aborted"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    if (signal?.aborted) return reject(new UploadAbortedError("aborted"));
    xhr.send(file);
  });
}
