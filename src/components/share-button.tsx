import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shareLinks } from '@/lib/share';

export function ShareButton({ slug, title, compact = false }: { slug: string; title: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button size="sm" variant="outline" title="Κοινοποίηση άρθρου" aria-label="Κοινοποίηση άρθρου" onClick={() => {
      setUrl(new URL(`/arthro/${encodeURIComponent(slug)}`, window.location.origin).href);
      setCopied(false); setOpen(true);
    }}><Share2 className="size-4"/>{!compact && 'Κοινοποίηση'}</Button>
    <DialogContent className="w-[calc(100%-2rem)] max-w-md">
      <DialogHeader><DialogTitle>Κοινοποίηση άρθρου</DialogTitle><DialogDescription className="break-words">{title}</DialogDescription></DialogHeader>
      <div className="flex min-w-0 gap-2"><input readOnly aria-label="Σύνδεσμος άρθρου" className="cms-input min-w-0 flex-1" value={url} onFocus={e => e.target.select()}/><Button variant="outline" aria-label="Αντιγραφή συνδέσμου" title="Αντιγραφή συνδέσμου" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); }
        catch { toast.error('Δεν έγινε αντιγραφή. Επιλέξτε και αντιγράψτε τον σύνδεσμο.'); }
      }}>{copied ? <Check/> : <Copy/>}</Button></div>
      {copied && <p role="status" className="text-sm text-primary">Ο σύνδεσμος αντιγράφηκε.</p>}
      <div className="grid grid-cols-2 gap-2">{shareLinks(url, title).map(platform => <Button key={platform.label} variant="outline" asChild><a href={platform.href} target="_blank" rel="noopener noreferrer">{platform.label}</a></Button>)}</div>
    </DialogContent>
  </Dialog>;
}