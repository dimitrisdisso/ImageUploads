import { requirePhotoCredit } from './editorial';
import { signMediaPaths } from './admin.functions';

export type MediaAsset = {
  id: string;
  path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt: string | null;
  credit: string | null;
  created_at: string;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2400;

/** Downscale very large photos and re-encode them, keeping quality high. */
export async function optimizeImage(file: File): Promise<{ blob: Blob; width: number; height: number; type: string; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const passthrough = file.type === 'image/gif' || file.type === 'image/svg+xml';
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  if (passthrough || (scale === 1 && file.size < 600 * 1024)) {
    bitmap.close();
    return { blob: file, width, height, type: file.type, ext: file.name.split('.').pop()?.toLowerCase() || 'jpg' };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob || blob.size >= file.size) return { blob: file, width, height, type: file.type, ext: file.name.split('.').pop()?.toLowerCase() || 'jpg' };
  return { blob, width: w, height: h, type: 'image/webp', ext: 'webp' };
}

export async function uploadMedia(file: File, alt = '', credit = ''): Promise<MediaAsset> {
  const source = requirePhotoCredit(credit);
  if (!file.type.startsWith('image/')) throw new Error('Επιτρέπονται μόνο εικόνες.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Η εικόνα ξεπερνά τα 10 MB.');
  const optimized = await optimizeImage(file);
  const form = new FormData();
  form.append('file', new File([optimized.blob], `upload.${optimized.ext}`, { type: optimized.type }));
  form.append('filename', file.name.slice(0, 255));
  form.append('credit', source);
  form.append('alt', alt);
  form.append('width', String(optimized.width));
  form.append('height', String(optimized.height));
  let response: Response;
  try { response = await fetch('/api/admin/media', { method: 'POST', body: form }); }
  catch { throw new Error('Η εικόνα δεν ανέβηκε. Δοκιμάστε ξανά.'); }
  const body = (await response.json().catch(() => ({}))) as MediaAsset & { error?: string };
  if (!response.ok) throw new Error(body.error && body.error !== 'forbidden' ? body.error : 'Η εικόνα δεν ανέβηκε. Δοκιμάστε ξανά.');
  return body;
}

export async function signPaths(paths: string[], expires = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths)].filter(Boolean);
  if (!unique.length) return {};
  return signMediaPaths({ data: { paths: unique, seconds: Math.max(60, Math.min(expires, 7 * 86400)) } });
}

export function formatBytes(n: number | null) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
