// Storage abstraction. The public-URL methods back resources/recordings (public bucket);
// the signed-URL / head / readHead methods back the private file pipeline (TASK-014, SEC-03):
// private objects are never reachable by a permanent URL, the browser uploads straight to
// storage with a short-lived signed upload URL, and downloads use a short-lived signed URL.
export abstract class StorageProvider {
  abstract upload(bucket: string, path: string, file: Buffer, contentType: string): Promise<{ path: string }>;
  abstract getPublicUrl(bucket: string, path: string): string;
  abstract delete(bucket: string, path: string): Promise<void>;

  // A URL the browser PUTs the file bytes to (valid for about ttlSeconds).
  abstract createSignedUploadUrl(bucket: string, path: string, ttlSeconds: number): Promise<{ url: string }>;
  // A URL that returns the object, valid for ttlSeconds.
  abstract createSignedDownloadUrl(bucket: string, path: string, ttlSeconds: number): Promise<{ url: string }>;
  // Does the object exist, and how big is it (bytes)?
  abstract headObject(bucket: string, path: string): Promise<{ exists: boolean; size: number }>;
  // The first `length` bytes of the object (for magic-number checks).
  abstract readHead(bucket: string, path: string, length: number): Promise<Buffer>;
}
