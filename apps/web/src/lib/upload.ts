import { getBrowserSupabaseClient } from "./supabase-browser";

export async function uploadFileToSupabaseResumable(
  file: File,
  bucket: string,
  onProgress: (progress: number) => void
): Promise<string> {
  const supabase = getBrowserSupabaseClient();
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  onProgress(10);

  const { error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: true
  });

  onProgress(100);

  if (error) {
    console.error("Upload failed:", error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  return fileName;
}
