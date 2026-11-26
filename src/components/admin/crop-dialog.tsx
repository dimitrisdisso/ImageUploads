import { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { cropFile, type CropPixels } from '@/lib/crop';
import { toast } from 'sonner';
import { requirePhotoCredit } from '@/lib/editorial';

export function CropDialog({ file, onClose, onSave }: { file: File; onClose: () => void; onSave: (file: File, credit: string) => Promise<void> }) {
  const [url, setUrl] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(16 / 9);
  const [pixels, setPixels] = useState<CropPixels | null>(null);
  const [credit, setCredit] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const source = URL.createObjectURL(file); setUrl(source); return () => URL.revokeObjectURL(source); }, [file]);
  return <Dialog open onOpenChange={o => { if (!o && !busy) onClose(); }}><DialogContent className="max-h-[94dvh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Περικοπή φωτογραφίας</DialogTitle></DialogHeader><div className="relative h-64 overflow-hidden bg-ink sm:h-80">{url && <Cropper image={url} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, p) => setPixels(p)}/>}</div><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5"><Slider aria-label="Μεγέθυνση φωτογραφίας" min={1} max={3} step={0.05} value={[zoom]} onValueChange={v => setZoom(v[0] ?? 1)}/><select aria-label="Αναλογία περικοπής" className="cms-input w-auto" value={aspect} onChange={e => setAspect(Number(e.target.value))}><option value={16 / 9}>16:9</option><option value={3 / 2}>3:2</option><option value={1}>1:1</option></select></div><label className="text-sm font-semibold">Πηγή / δημιουργός φωτογραφίας *<input className="cms-input mt-2" value={credit} maxLength={500} onChange={e => setCredit(e.target.value)}/></label><div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Ακύρωση</Button><Button type="button" disabled={busy || !pixels || !credit.trim()} onClick={async () => { if (!pixels) return; setBusy(true); try { await onSave(await cropFile(file, pixels), requirePhotoCredit(credit)); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Η μεταφόρτωση απέτυχε.'); } finally { setBusy(false); } }}>{busy ? 'Αποθήκευση…' : 'Περικοπή & αποθήκευση'}</Button></div></DialogContent></Dialog>;
}