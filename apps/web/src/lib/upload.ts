import { supabase } from "./supabase";

export async function uploadFileToSupabaseResumable(
  file: File,
  bucket: string,
  onProgress: (progress: number) => void
): Promise<string> {
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  onProgress(10);

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: true
  });

  onProgress(100);

  if (error) {
    throw error;
  }

  return fileName;
}
