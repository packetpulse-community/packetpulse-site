// Additive only — no upload endpoints/UI exist yet (avatarUrl, resource/recording
// URLs are all externally-hosted links today, confirmed via full-repo search).
// This interface exists so a future upload feature has a Supabase Storage backend
// ready to use; there is deliberately no local-disk/MinIO implementation for
// docker mode since nothing currently needs one (platform-mode plan §4).
export abstract class StorageProvider {
  abstract upload(bucket: string, path: string, file: Buffer, contentType: string): Promise<{ path: string }>;
  abstract getPublicUrl(bucket: string, path: string): string;
  abstract delete(bucket: string, path: string): Promise<void>;
}
