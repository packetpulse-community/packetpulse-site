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
}
