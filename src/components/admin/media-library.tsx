import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ImagePlus, Loader2, Search, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { deleteMedia, listMedia, updateMedia } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatBytes, signPaths, uploadMedia, type MediaAsset } from '@/lib/media';
import { postsUsingPath } from '@/lib/article-html';

type Post = { id: string; status: string; data: Record<string, unknown> };
export type PickedImage = { path: string; url: string; alt: string; credit: string };

const RANGES = [
  ['all', 'Όλες οι ημερομηνίες'],
  ['7', 'Τελευταίες 7 ημέρες'],
  ['30', 'Τελευταίες 30 ημέρες'],
] as const;

export function useMediaAssets() {
  return useQuery({
    queryKey: ['media-assets'],
    queryFn: async () => {
      return listMedia();
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function MediaLibrary({ posts, onPick }: { posts: Post[]; onPick?: ((img: PickedImage) => void) | undefined }) {
  const qc = useQueryClient();
  const media = useMediaAssets();
  const [q, setQ] = useState('');
  const [range, setRange] = useState<(typeof RANGES)[number][0]>('all');
  const [selected, setSelected] = useState<(MediaAsset & { url: string }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [credit, setCredit] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const since = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return (media.data ?? []).filter((m) => m.filename.toLowerCase().includes(q.toLowerCase()) && new Date(m.created_at).getTime() >= since);
  }, [media.data, q, range]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!credit.trim()) { toast.error('Συμπληρώστε πηγή / δημιουργό φωτογραφίας.'); return; }
    setUploading(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      try {
        await uploadMedia(f, '', credit);
        ok++;
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : 'Η μεταφόρτωση απέτυχε.'}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (ok) {
      toast.success(ok === 1 ? 'Η εικόνα ανέβηκε.' : `Ανέβηκαν ${ok} εικόνες.`);
      await qc.invalidateQueries({ queryKey: ['media-assets'] });
    }
  };

  return (
    <div className="space-y-5">
      <label className="block text-sm font-semibold">Πηγή / δημιουργός νέων φωτογραφιών *<input className="cms-input mt-2" maxLength={500} value={credit} onChange={e => setCredit(e.target.value)}/></label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input aria-label="Αναζήτηση εικόνας" className="cms-input pl-10" placeholder="Αναζήτηση με όνομα αρχείου…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Φίλτρο ημερομηνίας" className="cms-input w-auto" value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
          {RANGES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" aria-label="Μεταφόρτωση εικόνων" onChange={(e) => void upload(e.target.files)} />
        <Button type="button" disabled={uploading || !credit.trim()} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {uploading ? 'Μεταφόρτωση…' : 'Μεταφόρτωση εικόνων'}
        </Button>
      </div>
      {media.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Φόρτωση βιβλιοθήκης…</p>
      ) : media.error ? (
        <p role="alert">Η βιβλιοθήκη δεν φορτώθηκε. <Button variant="link" onClick={() => void media.refetch()}>Δοκιμάστε ξανά</Button></p>
      ) : list.length === 0 ? (
        <p className="border bg-background p-8 text-muted-foreground">{media.data?.length ? 'Δεν βρέθηκαν εικόνες με αυτά τα κριτήρια.' : 'Η βιβλιοθήκη είναι άδεια. Ανεβάστε την πρώτη σας εικόνα.'}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((m) => {
            const used = postsUsingPath(posts, m.path);
            return (
              <li key={m.id}>
                <button type="button" onClick={() => setSelected(m)} className="group block w-full overflow-hidden border bg-background text-left focus-visible:outline-2 focus-visible:outline-primary">
                  <span className="block aspect-square overflow-hidden bg-muted">
                    {m.url && <img src={m.url} alt={m.alt ?? ''} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                  </span>
                  <span className="block truncate px-2 pt-2 text-xs font-semibold">{m.filename}</span>
                  <span className="block px-2 pb-2 text-[11px] text-muted-foreground">{new Date(m.created_at).toLocaleDateString('el-GR')} · {used.length ? `σε ${used.length} καταχωρίσεις` : 'δεν χρησιμοποιείται'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <MediaDetails
          asset={selected}
          posts={posts}
          onClose={() => setSelected(null)}
          onPick={onPick ? (img) => { onPick(img); setSelected(null); } : undefined}
        />
      )}
    </div>
  );
}

function MediaDetails({ asset, posts, onClose, onPick }: { asset: MediaAsset & { url: string }; posts: Post[]; onClose: () => void; onPick?: ((img: PickedImage) => void) | undefined }) {
  const qc = useQueryClient();
  const [alt, setAlt] = useState(asset.alt ?? '');
  const [credit, setCredit] = useState(asset.credit ?? '');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [force, setForce] = useState(false);
  const used = postsUsingPath(posts, asset.path);
  const usedPublished = used.filter((p) => p.status === 'published');

  const saveAlt = async () => {
    setSaving(true);
    const error = await updateMedia({ data: { id: asset.id, alt, credit } }).then(() => null, (e: unknown) => e ?? true);
    setSaving(false);
    if (error) toast.error('Το εναλλακτικό κείμενο δεν αποθηκεύτηκε.');
    else {
      toast.success('Αποθηκεύτηκε.');
      await qc.invalidateQueries({ queryKey: ['media-assets'] });
    }
  };
  const copy = async () => {
    const urls = await signPaths([asset.path], 7 * 86400).catch(() => ({} as Record<string, string>));
    const url = urls[asset.path];
    if (!url) { toast.error('Ο σύνδεσμος δεν δημιουργήθηκε.'); return; }
    await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
    toast.success('Ο σύνδεσμος αντιγράφηκε (ισχύει για 7 ημέρες).');
  };
  const remove = async () => {
    try { await deleteMedia({ data: { id: asset.id } }); } catch { toast.error('Η διαγραφή απέτυχε.'); return; }
    toast.success('Η εικόνα διαγράφηκε.');
    await qc.invalidateQueries({ queryKey: ['media-assets'] });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-all pr-6">{asset.filename}</DialogTitle>
          <DialogDescription>Ανέβηκε {new Date(asset.created_at).toLocaleString('el-GR', { dateStyle: 'long', timeStyle: 'short' })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <a href={asset.url} target="_blank" rel="noreferrer" className="block bg-muted">
            <img src={asset.url} alt={asset.alt ?? ''} className="mx-auto max-h-[60vh] w-auto object-contain" />
          </a>
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Διαστάσεις</dt><dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}</dd>
              <dt className="text-muted-foreground">Μέγεθος</dt><dd>{formatBytes(asset.size_bytes)}</dd>
              <dt className="text-muted-foreground">Τύπος</dt><dd>{asset.mime_type ?? '—'}</dd>
            </dl>
            <label className="block font-semibold">Εναλλακτικό κείμενο
              <textarea className="cms-input mt-2" rows={2} maxLength={300} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Περιγράψτε την εικόνα για αναγνώστες οθόνης" />
            </label>
            <label className="block font-semibold">Πηγή / δημιουργός *<input className="cms-input mt-2" maxLength={500} value={credit} onChange={e => setCredit(e.target.value)}/></label>
            <Button size="sm" variant="outline" disabled={saving || !credit.trim()} onClick={() => void saveAlt()}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση περιγραφής'}</Button>
            <div>
              <p className="font-semibold">Χρησιμοποιείται σε</p>
              {used.length ? (
                <ul className="mt-1 list-disc pl-5">
                  {used.map((p) => <li key={p.id}>{String(p.data['title'] || 'Χωρίς τίτλο')} <span className="text-muted-foreground">({p.status === 'published' ? 'δημοσιευμένο' : 'προσχέδιο'})</span></li>)}
                </ul>
              ) : <p className="text-muted-foreground">Σε καμία καταχώριση.</p>}
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {onPick && <Button onClick={() => onPick({ path: asset.path, url: asset.url, alt: alt || asset.alt || '', credit: credit || asset.credit || '' })}><Check />Επιλογή</Button>}
              <Button variant="outline" onClick={() => void copy()}><Copy />Αντιγραφή συνδέσμου</Button>
              <Button variant="ghost" onClick={() => { setForce(false); setConfirm(true); }}><Trash2 />Διαγραφή</Button>
            </div>
          </div>
        </div>
        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Διαγραφή εικόνας;</AlertDialogTitle>
              <AlertDialogDescription>
                {usedPublished.length
                  ? `Η εικόνα εμφανίζεται σε ${usedPublished.length} δημοσιευμένες καταχωρίσεις. Αν τη διαγράψετε, δεν θα εμφανίζεται πλέον. Αντικαταστήστε την πρώτα.`
                  : used.length
                    ? 'Η εικόνα χρησιμοποιείται σε προσχέδια. Η διαγραφή είναι οριστική.'
                    : 'Η διαγραφή είναι οριστική και δεν αναιρείται.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {usedPublished.length > 0 && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />Καταλαβαίνω, διαγραφή παρ’ όλα αυτά</label>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
              <AlertDialogAction disabled={usedPublished.length > 0 && !force} onClick={() => void remove()}>Οριστική διαγραφή</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

export function MediaPickerDialog({ open, onOpenChange, posts, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; posts: Post[]; onPick: (img: PickedImage) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Βιβλιοθήκη εικόνων</DialogTitle>
          <DialogDescription>Ανεβάστε νέα εικόνα ή πατήστε μια υπάρχουσα και «Επιλογή».</DialogDescription>
        </DialogHeader>
        <MediaLibrary posts={posts} onPick={(img) => { onPick(img); onOpenChange(false); }} />
      </DialogContent>
    </Dialog>
  );
}
