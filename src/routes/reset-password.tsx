import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import {createFileRoute,Link} from '@tanstack/react-router';
import {useEffect,useState} from 'react';
import {resetPassword} from '@/lib/auth.functions';
import {useReaderAuth} from '@/lib/reader-auth';
import {Button} from '@/components/ui/button';
import {passwordSchema} from '@/lib/reader';
export const Route=createFileRoute('/reset-password')({head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, 'Νέος κωδικός'); return result; },
  component:Reset});
function Reset(){
  const [token,setToken]=useState<string|null>(null);const {refresh}=useReaderAuth();
  const [valid,setValid]=useState(false);const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
  useEffect(()=>{const found=new URLSearchParams(window.location.hash.slice(1)).get('token')??sessionStorage.getItem('reset-token');if(found){sessionStorage.setItem('reset-token',found);setToken(found);setValid(true);}history.replaceState(null,'',window.location.pathname);},[]);
  return <main className="mx-auto max-w-md px-6 py-20"><h1 className="text-3xl font-bold">Νέος κωδικός</h1>{valid&&token&&!done?<form className="mt-8 space-y-4" onSubmit={async e=>{
    e.preventDefault();setMessage('');const parsed=passwordSchema.safeParse(password);if(!parsed.success){setMessage(parsed.error.issues[0]?.message??'Ελέγξτε τον κωδικό σας.');return;}setBusy(true);
    try{await resetPassword({data:{token:token??'',password:parsed.data}});sessionStorage.removeItem('reset-token');setDone(true);setValid(false);setMessage('Ο κωδικός ενημερώθηκε.');void refresh();}catch(error){setMessage(error instanceof Error&&error.message==='pwned_password'?'Αυτός ο κωδικός έχει εμφανιστεί σε γνωστή διαρροή κωδικών. Επιλέξτε διαφορετικό.':'Ο κωδικός δεν ενημερώθηκε. Ζητήστε νέο σύνδεσμο επαναφοράς και δοκιμάστε ξανά.');}finally{setBusy(false);}
  }}><label className="block">Νέος κωδικός<input className="cms-input mt-2" required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label><Button disabled={busy} type="submit">{busy?'Αποθήκευση…':'Αποθήκευση'}</Button></form>:!done&&<p className="mt-6">Ανοίξτε τον σύνδεσμο επαναφοράς από το email σας.</p>}<p role="status" className="mt-4">{message}</p><Link className="mt-5 inline-block text-primary underline" to="/auth" search={{mode:'login',redirect:'/profile'}}>Σύνδεση</Link></main>;
}
