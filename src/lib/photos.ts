import { supabase } from './db';

/** Sube fotos (data URL) del historial de un caso y devuelve sus direcciones. Sin Supabase (demo) las deja como están. */
export async function uploadCommentPhotos(failureId: string, commentId: string, dataUrls: string[]): Promise<string[]> {
  if (!supabase || !dataUrls.length) return dataUrls;
  return Promise.all(dataUrls.map(async (d, i) => {
    const blob = await (await fetch(d)).blob();
    const path = `${failureId}/c-${commentId}-${i}.jpg`;
    const { error } = await supabase!.storage.from('failure-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return supabase!.storage.from('failure-photos').getPublicUrl(path).data.publicUrl;
  }));
}
