import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSiteSettings } from '@/lib/cms';
import { githubUploadAvailable, uploadToGithub } from '@/lib/media-github';
import {
  checkMediaUrl, mediaSourceFromSettings, normalizeMediaInput, MediaUrlError,
  type MediaKind, type MediaFileKind,
} from '@/lib/media-embed';

export type EmbedResult = { kind: MediaKind; src: string; label: string; caption: string; credit: string; poster: string; captions: string };

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/ogg,audio/wav';
const KIND_LABEL: Record<MediaKind, string> = { image: 'εικόνα', video: 'βίντεο', audio: 'ηχητικό' };

/** Turns the pasted text into a checked URL; returns the error text instead of throwing. */
function resolve(input: string, source: ReturnType<typeof mediaSourceFromSettings>, kinds: MediaFileKind[]) {
  if (!input.trim()) return { url: '', error: '', notes: [] as string[], kind: null as MediaKind | null };
  try {
    const url = normalizeMediaInput(input, source);
    const check = checkMediaUrl(url, source, kinds);
    if (!check.ok) return { url: '', error: check.message, notes: [], kind: null };
    return { url, error: '', notes: check.notes, kind: check.parsed.kind as MediaKind };
  } catch (e) {
    return { url: '', error: e instanceof MediaUrlError ? e.message : 'Μη έγκυρη διεύθυνση.', notes: [], kind: null };
  }
}

/**
 * Adds an image, video or audio file from the GitHub media repository (served by jsDelivr).
 * Requires alt text / title, a credit and a confirmation that the file may be published.
 */
export function MediaEmbedDialog({
  open, onOpenChange, kinds = ['image', 'video', 'audio'], title = 'Πολυμέσα από GitHub (jsDelivr)', onInsert,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kinds?: MediaKind[];
  title?: string;
  onInsert: (result: EmbedResult) => void;
}) {
  const source = mediaSourceFromSettings(useSiteSettings());
  const [file, setFile] = useState('');
  const [label, setLabel] = useState('');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState('');
  const [poster, setPoster] = useState('');
  const [captions, setCaptions] = useState('');
  const [own, setOwn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [auto, setAuto] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) void githubUploadAvailable().then(setAuto); }, [open]);

  const upload = async (picked: File | undefined, target: 'file' | 'poster' | 'captions') => {
    if (!picked) return;
    setBusy(true); setError('');
    try {
      const done = await uploadToGithub(picked);
      if (target === 'file') setFile(done.url); else if (target === 'poster') setPoster(done.url); else setCaptions(done.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Το αρχείο δεν ανέβηκε.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) { setFile(''); setLabel(''); setCaption(''); setCredit(''); setPoster(''); setCaptions(''); setOwn(false); setFailed(false); setError(''); }
  }, [open]);

  const main = useMemo(() => resolve(file, source, kinds), [file, source, kinds]);
  const posterR = useMemo(() => resolve(poster, source, ['image']), [poster, source]);
  const captionsR = useMemo(() => resolve(captions, source, ['captions']), [captions, source]);
  useEffect(() => setFailed(false), [main.url]);
  const kind = main.kind;
  const accepted = kinds.map((k) => KIND_LABEL[k]).join(', ');

  const submit = () => {
    if (!source) return setError('Ορίστε πρώτα το αποθετήριο στις Ρυθμίσεις → Πολυμέσα (GitHub + jsDelivr).');
    if (!main.url || !kind) return setError(main.error || 'Επικολλήστε τη διαδρομή ή τον σύνδεσμο του αρχείου.');
    if (!label.trim()) return setError(kind === 'image' ? 'Το εναλλακτικό κείμενο είναι υποχρεωτικό (περιγράψτε τι δείχνει η φωτογραφία).' : 'Γράψτε έναν σύντομο τίτλο.');
    if (!credit.trim()) return setError('Η πηγή / ο δημιουργός είναι υποχρεωτικά.');
    if (!own) return setError('Επιβεβαιώστε ότι το αρχείο είναι δικό μας ή έχουμε άδεια δημοσίευσης.');
    if (poster.trim() && (posterR.error || !posterR.url)) return setError(posterR.error);
    if (captions.trim() && (captionsR.error || !captionsR.url)) return setError(captionsR.error);
    onInsert({ kind, src: main.url, label: label.trim(), caption: caption.trim(), credit: credit.trim(), poster: kind === 'video' ? posterR.url : '', captions: kind === 'video' ? captionsR.url : '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Επιλέξτε αρχείο από τον υπολογιστή σας· ανεβαίνει μόνο του στο GitHub. Επιτρέπεται: {accepted}.
          </DialogDescription>
        </DialogHeader>
        {!source && <p role="alert" className="border border-primary bg-muted p-2 text-sm">Δεν έχει οριστεί αποθετήριο. Πηγαίνετε στις Ρυθμίσεις → «Πολυμέσα (GitHub + jsDelivr)».</p>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); submit(); }}>
          {auto && (
            <div className="space-y-1">
              <input ref={pick} type="file" className="sr-only" aria-label="Επιλογή αρχείου" accept={ACCEPT} onChange={(e) => { void upload(e.target.files?.[0], 'file'); e.target.value = ''; }} />
              <Button type="button" variant="outline" disabled={busy} onClick={() => pick.current?.click()}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />}{busy ? 'Μεταφόρτωση…' : 'Επιλογή αρχείου από τον υπολογιστή'}
              </Button>
              <p className="text-xs text-muted-foreground">Το αρχείο αποθηκεύεται αυτόματα στο GitHub και παίρνει μόνιμο σύνδεσμο. Δεν χρειάζεται να κάνετε τίποτα στο GitHub.</p>
            </div>
          )}
          {auto === false && <p className="text-xs text-muted-foreground">Η αυτόματη μεταφόρτωση δεν είναι ενεργή (λείπει το GITHUB_TOKEN). Μπορείτε να επικολλήσετε σύνδεσμο ή διαδρομή αρχείου που έχει ήδη ανέβει στο GitHub.</p>}
          <label className="block text-sm font-semibold">{auto ? 'ή σύνδεσμος / διαδρομή αρχείου που υπάρχει ήδη' : 'Αρχείο (διαδρομή ή σύνδεσμος)'}
            <input autoFocus className="cms-input mt-1" value={file} onChange={(e) => { setFile(e.target.value); setError(''); }} placeholder="images/2026/11/plateia.jpg" />
          </label>
          {main.error && <p role="alert" className="text-sm text-primary">{main.error}</p>}
          {main.url && (
            <div className="space-y-1">
              <p className="break-all text-xs text-muted-foreground">{main.url}</p>
              {main.notes.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
              {failed ? (
                <p role="alert" className="text-sm text-primary">Το αρχείο δεν φορτώνει. Ελέγξτε ότι το αποθετήριο είναι δημόσιο, ότι το αρχείο έχει ανέβει και ότι η έκδοση (tag/branch) υπάρχει.</p>
              ) : kind === 'image' ? (
                <img src={main.url} alt="" className="max-h-40 border" onError={() => setFailed(true)} />
              ) : kind === 'video' ? (
                <video src={main.url} controls preload="metadata" className="max-h-48 w-full border" onError={() => setFailed(true)} />
              ) : (
                <audio src={main.url} controls preload="metadata" className="w-full" onError={() => setFailed(true)} />
              )}
            </div>
          )}
          <label className="block text-sm font-semibold">{kind === 'image' || !kind ? 'Εναλλακτικό κείμενο (υποχρεωτικό)' : 'Τίτλος (υποχρεωτικός)'}
            <input className="cms-input mt-1" maxLength={300} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'image' || !kind ? 'Τι φαίνεται στη φωτογραφία, για όσους δεν τη βλέπουν' : 'Π.χ. Συνέντευξη με τον πρόεδρο του συλλόγου'} />
          </label>
          <label className="block text-sm font-semibold">Λεζάντα (προαιρετική)
            <input className="cms-input mt-1" maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Πηγή / δημιουργός (υποχρεωτικό)
            <input className="cms-input mt-1" maxLength={200} value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="Όνομα φωτογράφου ή «Επιτροπή Άνω Πόλης»" />
          </label>
          {kind === 'video' && (
            <>
              <label className="block text-sm font-semibold">Εικόνα προεπισκόπησης (προαιρετική)
                <input className="cms-input mt-1" value={poster} onChange={(e) => setPoster(e.target.value)} placeholder="images/2026/11/plateia-poster.jpg" />
              </label>
              {auto && <input type="file" aria-label="Μεταφόρτωση εικόνας προεπισκόπησης" accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={(e) => { void upload(e.target.files?.[0], 'poster'); e.target.value = ''; }} />}
              {poster && posterR.error && <p role="alert" className="text-sm text-primary">{posterR.error}</p>}
              <label className="block text-sm font-semibold">Υπότιτλοι .vtt (προαιρετικοί, προτείνονται)
                <input className="cms-input mt-1" value={captions} onChange={(e) => setCaptions(e.target.value)} placeholder="video/2026/11/synenteuxi.el.vtt" />
              </label>
              {auto && <input type="file" aria-label="Μεταφόρτωση υποτίτλων" accept=".vtt,text/vtt" className="text-xs" onChange={(e) => { void upload(e.target.files?.[0], 'captions'); e.target.value = ''; }} />}
              {captions && captionsR.error && <p role="alert" className="text-sm text-primary">{captionsR.error}</p>}
            </>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={own} onChange={(e) => setOwn(e.target.checked)} />
            <span>Επιβεβαιώνω ότι το αρχείο είναι δικό μας ή έχουμε γραπτή άδεια να το δημοσιεύσουμε.</span>
          </label>
          {error && <p role="alert" className="text-sm font-semibold text-primary">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ακύρωση</Button>
            <Button type="submit" disabled={!source}>Εισαγωγή</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
