import { MAX_FILE_BYTES } from './media-embed';
import { optimizeImage } from './media';

export type GithubUpload = { url: string; path: string; kind: 'image' | 'video' | 'audio' | 'captions'; bytes: number };

/** Whether the server can publish to GitHub on its own (the GITHUB_TOKEN secret is set). */
export async function githubUploadAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/admin/media-github');
    const body = (await response.json().catch(() => ({}))) as { configured?: boolean };
    return response.ok && Boolean(body.configured);
  } catch {
    return false;
  }
}

/** Sends a file to the site, which commits it to the GitHub media repository. Returns the permanent jsDelivr URL. */
export async function uploadToGithub(file: File): Promise<GithubUpload> {
  let upload: Blob = file;
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    try { upload = (await optimizeImage(file)).blob; } catch { upload = file; }
  }
  if (upload.size > MAX_FILE_BYTES) throw new Error('Το αρχείο ξεπερνά τα 20 MB. Μικρύνετέ το ή χρησιμοποιήστε YouTube για βίντεο.');
  const form = new FormData();
  form.append('file', new File([upload], file.name, { type: upload.type || file.type }));
  form.append('filename', file.name.slice(0, 200));
  let response: Response;
  try { response = await fetch('/api/admin/media-github', { method: 'POST', body: form }); }
  catch { throw new Error('Το αρχείο δεν ανέβηκε. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.'); }
  const body = (await response.json().catch(() => ({}))) as Partial<GithubUpload> & { error?: string };
  if (!response.ok || !body.url) throw new Error(body.error && body.error !== 'forbidden' ? body.error : 'Το αρχείο δεν ανέβηκε. Δοκιμάστε ξανά.');
  return body as GithubUpload;
}
