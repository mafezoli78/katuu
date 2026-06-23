import { supabase } from '@/integrations/supabase/client';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// NOTA: o projeto NÃO tem Image Transformation habilitado no Storage. Pedir
// `{ transform }` no createSignedUrl faz a assinatura falhar silenciosamente
// (o item volta sem signedUrl e sem erro no topo do batch), e o cliente cai no
// path cru → imagem quebrada. Por isso servimos a imagem ORIGINAL; o
// redimensionamento visual já é feito no CSS (object-cover nos cards). Se um
// dia o Image Transformation for habilitado, dá pra reintroduzir o transform.

/**
 * Generate a signed URL for a checkin selfie file path.
 * Returns null if path is empty/null or signing fails.
 */
export async function getSignedSelfieUrl(
  filePath: string | null
): Promise<string | null> {
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
export async function getSignedSelfieUrls(
  filePaths: string[]
): Promise<Map<string, string>> {
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
    // createSignedUrls (batch) pode trazer erro POR ITEM mesmo com error null
    // no topo — logamos por item para não falhar em silêncio (lição da selfie).
    if (item.error) {
      console.warn('[storage] Signed URL item failed:', item.path, item.error);
      return;
    }
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  });

  return result;
}
