import { supabase } from "./supabase";
import * as tus from "tus-js-client";

export async function uploadFileToSupabaseResumable(
  file: File,
  bucket: string,
  onProgress: (progress: number) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Use anon key for free-tier/unauthenticated uploads if no session
    // Note: ensure RLS policies on the bucket allow anon inserts for this to work.

    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL!.split("//")[1].split(".")[0];
    const uploadUrl = `https://${projectId}.supabase.co/storage/v1/upload/resumable`;

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const upload = new tus.Upload(file, {
      endpoint: uploadUrl,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        Authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: fileName,
        contentType: file.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // 6MB chunks
      onError: (error) => {
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
        onProgress(percentage);
      },
      onSuccess: () => {
        // TUS upload succeeded. Return the storage path.
        resolve(fileName);
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      } else {
        upload.start();
      }
    });
  });
}
