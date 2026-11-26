import { CropDialog } from './crop-dialog';
import { useEffect, useRef, useState } from 'react';
import { Film, ImagePlus, Library, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { bundledImages } from '@/lib/cms';
import { signPaths, uploadMedia } from '@/lib/media';
import { MediaPickerDialog } from './media-library';
import { MediaEmbedDialog } from './media-embed-dialog';

type Post = { id: string; status: string; data: Record<string, unknown> };

export function CoverField({ value, onChange, posts, onCreditChange }: { value: string; onChange: (v: string) => void; posts: Post[]; onCreditChange?: (credit: string) => void }) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [picker, setPicker] = useState(false);
  const [embed, setEmbed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) return setPreview('');
    if (bundledImages[value]) return setPreview(bundledImages[value]);
    if (value.startsWith('storage:')) {
      const path = value.slice(8);
      void signPaths([path]).then((u) => setPreview(u[path] ?? ''));
    } else setPreview(value);
  }, [value]);

  const upload = async (file: File, credit: string) => {
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadMedia(file, '', credit);
      onChange(`storage:${asset.path}`);
      onCreditChange?.(asset.credit ?? credit);
      await qc.invalidateQueries({ queryKey: ['media-assets'] });
      toast.success('Η φωτογραφία εξωφύλλου ανέβηκε.');
    } catch (e) {
      throw e;
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <span className="block text-sm font-semibold">Φωτογραφία εξωφύλλου</span>
      <div className="mt-2 flex flex-wrap gap-2">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Μεταφόρτωση φωτογραφίας εξωφύλλου" onChange={(e) => { setCropFile(e.target.files?.[0] ?? null); e.target.value=''; }} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}{busy ? 'Μεταφόρτωση…' : 'Μεταφόρτωση'}</Button>
        <Button type="button" variant="outline" onClick={() => setPicker(true)}><Library />Από τη βιβλιοθήκη</Button>
        <Button type="button" variant="outline" onClick={() => setEmbed(true)}><Film />Από GitHub (jsDelivr)</Button>
      </div>
      {preview && <img src={preview} alt="Φωτογραφία εξωφύλλου" className="mt-3 max-h-64 w-full object-cover" />}
      {cropFile && <CropDialog file={cropFile} onClose={() => setCropFile(null)} onSave={upload}/>}
      <MediaEmbedDialog open={embed} onOpenChange={setEmbed} kinds={['image']} title="Φωτογραφία εξωφύλλου από GitHub (jsDelivr)" onInsert={(m) => { onChange(m.src); onCreditChange?.(m.credit); }} />
      <MediaPickerDialog open={picker} onOpenChange={setPicker} posts={posts} onPick={(img) => { onChange(`storage:${img.path}`); onCreditChange?.(img.credit); }} />
    </div>
  );
}
