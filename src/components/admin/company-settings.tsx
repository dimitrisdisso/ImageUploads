import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { saveContent } from '@/lib/admin.functions';
import { resolveSettings, settingsGroups, isLinkableSetting, safeSocialUrl } from '@/lib/site-settings';

export function CompanySettings({ id, data, onSaved }: { id: string; data: Record<string, string>; onSaved: () => void }) {
  const [values, setValues] = useState(() => resolveSettings(data));
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form className="max-w-4xl" onSubmit={async event => {
    event.preventDefault();
    if (!values['companyName']?.trim()) { toast.error('Συμπληρώστε το όνομα της επιχείρησης.'); return; }
    if (Object.entries(values).some(([key, value]) => key.endsWith('Link') && value.trim() && !safeSocialUrl(value))) { toast.error('Οι σύνδεσμοι πρέπει να αρχίζουν με https:// ή http://.'); return; }
    setBusy(true);
    try {
      await saveContent({ data: { id, kind: 'settings', status: 'published', data: { ...values, companyName: values['companyName'].trim() } } });
      onSaved(); await router.invalidate();
      toast.success('Οι πληροφορίες ενημερώθηκαν στον ιστότοπο.');
    } catch { toast.error('Οι πληροφορίες δεν αποθηκεύτηκαν. Δοκιμάστε ξανά.'); }
    finally { setBusy(false); }
  }}>
    {settingsGroups.map(group => <fieldset key={group.title} className="min-w-0 border-b py-8"><legend className="pt-6 text-xl font-bold">{group.title}</legend><div className="grid gap-5 sm:grid-cols-2">{group.fields.map(field => {
      const [key, label] = field;
      const type = field.length > 3 ? field[3] : 'text';
      const multiline = /Text|Description|Intro|Tagline|aboutWork$|aboutIndependence$|_description$/.test(key);
      return <div key={key} className={`min-w-0 text-sm font-semibold ${multiline ? 'sm:col-span-2' : ''}`}><label>{label}{multiline ? <textarea className="cms-input mt-2 font-normal" rows={3} maxLength={5000} value={values[key] ?? ''} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))}/> : <input className="cms-input mt-2 font-normal" type={type} required={key === 'companyName'} maxLength={500} value={values[key] ?? ''} onChange={e => setValues(old => ({ ...old, [key]: e.target.value }))}/>}</label>{isLinkableSetting(key) && <label className="mt-3 block text-xs text-muted-foreground">Σύνδεσμος για: {label} (προαιρετικό)<input type="url" aria-label={`Σύνδεσμος για: ${label}`} className="cms-input mt-1 font-normal" maxLength={2000} placeholder="https://" value={values[`${key}Link`] ?? ''} onChange={e => setValues(old => ({ ...old, [`${key}Link`]: e.target.value }))}/></label>}</div>;
    })}</div></fieldset>)}
    <div className="sticky bottom-0 flex justify-end border-t bg-background py-4"><Button type="submit" disabled={busy}><Save/>{busy ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}</Button></div>
  </form>;
}