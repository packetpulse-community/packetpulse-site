import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase-client.provider";
import { StorageProvider } from "./storage-provider";

@Injectable()
export class SupabaseStorageProvider extends StorageProvider {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {
    super();
  }

  async upload(bucket: string, path: string, file: Buffer, contentType: string) {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: true });
    if (error || !data) throw new InternalServerErrorException(`Supabase Storage: upload failed (${error?.message})`);
    return { path: data.path };
  }

  getPublicUrl(bucket: string, path: string): string {
    return this.supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async delete(bucket: string, path: string) {
    const { error } = await this.supabase.storage.from(bucket).remove([path]);
    if (error) throw new InternalServerErrorException(`Supabase Storage: delete failed (${error.message})`);
  }

  async createSignedUploadUrl(bucket: string, path: string) {
    // Supabase fixes the upload URL lifetime (2 hours) itself; the object path is single-use
    // and the file is only trusted after /complete verifies it, so the window is not exploitable.
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new InternalServerErrorException(`Supabase Storage: signed upload failed (${error?.message})`);
    return { url: data.signedUrl };
  }

  async createSignedDownloadUrl(bucket: string, path: string, ttlSeconds: number) {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error || !data) throw new InternalServerErrorException(`Supabase Storage: signed download failed (${error?.message})`);
    return { url: data.signedUrl };
  }

  async headObject(bucket: string, path: string) {
    const slash = path.lastIndexOf("/");
    const dir = slash >= 0 ? path.slice(0, slash) : "";
    const name = path.slice(slash + 1);
    const { data, error } = await this.supabase.storage.from(bucket).list(dir, { search: name, limit: 10 });
    if (error) throw new InternalServerErrorException(`Supabase Storage: head failed (${error.message})`);
    const hit = data?.find((o) => o.name === name);
    const size = Number((hit?.metadata as { size?: number } | null)?.size ?? 0);
    return { exists: !!hit, size };
  }

  async readHead(bucket: string, path: string, length: number) {
    const { url } = await this.createSignedDownloadUrl(bucket, path, 30);
    const res = await fetch(url, { headers: { Range: `bytes=0-${length - 1}` } });
    if (!res.ok) throw new InternalServerErrorException(`Supabase Storage: read failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer()).subarray(0, length);
  }
}
