import { supabase } from '@/integrations/supabase/client';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Generate a signed URL for a checkin selfie file path.
 * Returns null if path is empty/null or signing fails.
 */
export async function getSignedSelfieUrl(filePath: string | null): Promise<string | null> {
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from('checkin-selfies')
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    console.error('[storage] Failed to create signed URL:', error.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * Generate signed URLs for multiple file paths in batch.
 * Returns a map of filePath -> signedUrl.
 */
export async function getSignedSelfieUrls(filePaths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const validPaths = filePaths.filter(Boolean);

  if (validPaths.length === 0) return result;

  const { data, error } = await supabase.storage
    .from('checkin-selfies')
    .createSignedUrls(validPaths, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    console.error('[storage] Failed to create signed URLs:', error.message);
    return result;
  }

  (data || []).forEach((item) => {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  });

  return result;
}
