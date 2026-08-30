import { supabase } from "./supabase";

export async function uploadFileToSupabaseResumable(
  file: File,
  bucket: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // We use standard upload instead of TUS to avoid strict RLS 403 errors on the resumable endpoint.
  // Standard upload works perfectly with our public RLS policies.
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

  // Simulate progress since standard upload doesn't have onProgress in supabase-js v2 natively without XMLHttpRequest
  let simProgress = 0;
  const interval = setInterval(() => {
    if (simProgress < 90) {
      simProgress += 10;
      onProgress(simProgress);
    }
  }, 200);

  const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: true
  });

  clearInterval(interval);
  onProgress(100);

  if (error) {
    throw error;
  }

  return fileName;
}
