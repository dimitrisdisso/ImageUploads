import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {Trash2,UserPlus} from 'lucide-react';
import {grantAdmin,listAdmins,revokeAdmin} from '@/lib/admin.functions';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

export function AdminsPanel(){
  const qc=useQueryClient();const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);
  const admins=useQuery({queryKey:['admins'],queryFn:()=>listAdmins()});
  const add=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);try{await grantAdmin({data:{email}});toast.success('Προστέθηκε διαχειριστής.');setEmail('');void qc.invalidateQueries({queryKey:['admins']});}catch(error){toast.error(error instanceof Error&&error.message.startsWith('Δεν βρέθηκε')?'Δεν βρέθηκε λογαριασμός. Το άτομο πρέπει πρώτα να εγγραφεί και να επιβεβαιώσει το email του (ή να συνδεθεί με Google).':'Η προσθήκη απέτυχε.');}finally{setBusy(false);}};
  const remove=async(id:string)=>{if(!window.confirm('Αφαίρεση δικαιωμάτων διαχειριστή;'))return;try{await revokeAdmin({data:{userId:id}});toast.success('Αφαιρέθηκε.');void qc.invalidateQueries({queryKey:['admins']});}catch(error){const m=error instanceof Error?error.message:'';toast.error(m.startsWith('Δεν μπορείτε')||m.startsWith('Πρέπει')?m:'Η αφαίρεση απέτυχε.');}};
  return <div className="space-y-6">
    <form onSubmit={add} className="flex max-w-xl flex-col gap-3 border bg-background p-5 sm:flex-row sm:items-end">
      <label className="block flex-1 text-sm font-semibold">Email νέου διαχειριστή<input className="cms-input mt-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <Button disabled={busy} type="submit"><UserPlus/>Προσθήκη</Button>
    </form>
    <p className="text-sm text-muted-foreground">Το άτομο πρέπει να έχει συνδεθεί τουλάχιστον μία φορά πριν προστεθεί.</p>
    <div className="border bg-background">{admins.isPending?<p className="p-5">Φόρτωση…</p>:admins.error?<p className="p-5" role="alert">Δεν ήταν δυνατή η φόρτωση.</p>:admins.data.map(a=><div key={a.user_id} className="flex items-center justify-between gap-3 border-b px-5 py-4 last:border-0"><span className="min-w-0 break-all font-semibold">{a.email}</span><Button size="icon" variant="ghost" title="Αφαίρεση" onClick={()=>remove(a.user_id)}><Trash2/></Button></div>)}</div>
  </div>;
}
