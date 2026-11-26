import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { useSiteSettings } from "@/lib/cms";
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { requestPasswordReset, resendConfirmation, signIn, signUp } from '@/lib/auth.functions';
import { Button } from '@/components/ui/button';
import { useReaderAuth } from '@/lib/reader-auth';
import { emailSchema, registrationSchema, safeReturnPath } from '@/lib/reader';
import { z } from 'zod';
import { authFailure } from '@/lib/auth-feedback';

export const Route = createFileRoute('/auth')({
  validateSearch: (s: Record<string, unknown>): { mode: 'login' | 'register'; redirect: string; error?: 'link' | 'google' } => ({ mode: s['mode'] === 'register' ? 'register' : 'login', redirect: safeReturnPath(s['redirect']), ...(s['error'] === 'link' || s['error'] === 'google' ? { error: s['error'] } : {}) }),
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, 'Σύνδεση και εγγραφή'); return result; },
  component: Auth,
});
function Auth() {
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const { mode, redirect, error: linkError } = Route.useSearch();
  const { user, refresh } = useReaderAuth();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(linkError === 'google' ? 'Η σύνδεση με Google απέτυχε. Δοκιμάστε ξανά.' : linkError === 'link' ? 'Ο σύνδεσμος έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Συνδεθείτε ή ζητήστε νέο σύνδεσμο.' : ''); const [busy, setBusy] = useState(false); const [confirmation, setConfirmation] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const resend = async () => {
    setMessage('');
    const address = emailSchema.safeParse(email);
    if (!address.success) { setMessage('Συμπληρώστε το email σας για νέο σύνδεσμο επιβεβαίωσης.'); return; }
    if (Date.now() < resendAfter) { setMessage('Περιμένετε ένα λεπτό πριν ζητήσετε νέο σύνδεσμο.'); return; }
    setBusy(true);
    try {
      await resendConfirmation({ data: { email: address.data, redirect } });
      setResendAfter(Date.now() + 60_000);
      setMessage('Αν εκκρεμεί επιβεβαίωση, θα λάβετε νέο σύνδεσμο. Ελέγξτε και τα ανεπιθύμητα. Αν είχατε ήδη επιβεβαιώσει το email σας, συνδεθείτε ή επαναφέρετε τον κωδικό.');
    } catch (error) { setMessage(authFailure(error, 'Ο σύνδεσμος δεν στάλθηκε. Δοκιμάστε ξανά αργότερα.')); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!user) return;
    const remembered = sessionStorage.getItem('reader-return');
    const destination = safeReturnPath(remembered || redirect);
    sessionStorage.removeItem('reader-return');
    void navigate({ to: destination, replace: true });
  }, [user, redirect, navigate]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMessage('');
    try {
      if (forgot) {
        const address = emailSchema.parse(email); setBusy(true);
        await requestPasswordReset({ data: { email: address } });
        setMessage('Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε σύνδεσμο επαναφοράς.');
      } else if (mode === 'register') {
        const input = registrationSchema.parse({ name, email, password }); setBusy(true);
        sessionStorage.setItem('reader-return', redirect);
        const { outcome } = await signUp({ data: { ...input, redirect } });
        if (outcome === 'existing') setMessage('Αν έχετε ήδη λογαριασμό, συνδεθείτε ή επιλέξτε «Ξεχάσατε τον κωδικό;». Η επανάληψη της εγγραφής δεν αλλάζει τον κωδικό σας.');
        else if (outcome === 'confirmation') setConfirmation(true);
      } else {
        const address = emailSchema.parse(email); if (!password) throw new Error('Συμπληρώστε τον κωδικό σας.'); setBusy(true);
        await signIn({ data: { email: address, password } });
        await refresh();
      }
    } catch (error) {
      setMessage(error instanceof z.ZodError ? error.issues[0]?.message ?? 'Ελέγξτε τα στοιχεία σας.' : authFailure(error, forgot ? 'Η αποστολή απέτυχε. Δοκιμάστε ξανά αργότερα.' : mode === 'register' ? 'Η εγγραφή δεν ολοκληρώθηκε. Αν έχετε ήδη λογαριασμό, συνδεθείτε ή επαναφέρετε τον κωδικό σας.' : 'Δεν ήταν δυνατή η σύνδεση. Ελέγξτε τα στοιχεία σας και επιβεβαιώστε το email σας.'));
    } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-md px-5 py-10 sm:py-16"><Link to="/" className="kicker">← {settings['companyName']}</Link><h1 className="mt-8 text-3xl font-bold">{confirmation ? 'Ελέγξτε το email σας' : forgot ? 'Επαναφορά κωδικού' : mode === 'register' ? 'Δημιουργία λογαριασμού' : 'Καλώς ήρθατε ξανά'}</h1>{confirmation ? <div className="mt-6 space-y-5"><p role="status">Ελέγξτε το email σας και τα ανεπιθύμητα για τον σύνδεσμο ενεργοποίησης. Αν έχετε ήδη λογαριασμό, συνδεθείτε ή επαναφέρετε τον κωδικό σας.</p><Button disabled={busy} onClick={() => void resend()}>Νέος σύνδεσμος επιβεβαίωσης</Button><Button variant="outline" onClick={() => { setConfirmation(false); void navigate({ to: '/auth', search: { mode: 'login', redirect } }); }}>Επιστροφή στη σύνδεση</Button></div> : <><form className="mt-8 space-y-5" onSubmit={submit}>{mode === 'register' && !forgot && <label className="block text-sm font-semibold">Όνομα<input className="cms-input mt-2" required autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/></label>}<label className="block text-sm font-semibold">Email<input className="cms-input mt-2" type="email" required autoComplete="email" maxLength={255} value={email} onChange={e => setEmail(e.target.value)}/></label>{!forgot && <label className="block text-sm font-semibold">Κωδικός<input className="cms-input mt-2" type="password" required minLength={mode === 'register' ? 8 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)}/></label>}<Button disabled={busy} className="w-full" type="submit">{busy ? 'Παρακαλώ περιμένετε…' : forgot ? 'Αποστολή συνδέσμου' : mode === 'register' ? 'Εγγραφή' : 'Σύνδεση'}</Button>{mode === 'login' && <Button variant="link" type="button" onClick={() => { setForgot(!forgot); setMessage(''); }}>{forgot ? 'Επιστροφή στη σύνδεση' : 'Ξεχάσατε τον κωδικό;'}</Button>}{mode === 'login' && !forgot && <Button disabled={busy} variant="link" type="button" onClick={() => void resend()}>Νέος σύνδεσμος επιβεβαίωσης</Button>}</form>{!forgot && <div className="mt-5 space-y-4 border-t pt-5"><Button disabled={busy} variant="outline" className="w-full" onClick={() => { setBusy(true); setMessage(''); sessionStorage.removeItem('reader-return'); window.location.assign(`/api/auth/google?redirect=${encodeURIComponent(redirect)}`); }}>Συνέχεια με Google</Button><p className="text-center text-sm">{mode === 'register' ? 'Έχετε ήδη λογαριασμό;' : 'Δεν έχετε λογαριασμό;'} <Link className="font-bold text-primary underline" to="/auth" search={{ mode: mode === 'register' ? 'login' : 'register', redirect }} onClick={() => setMessage('')}>{mode === 'register' ? 'Σύνδεση' : 'Εγγραφή'}</Link></p></div>}</>}{message && <p role="alert" className="mt-5 text-sm text-primary">{message}</p>}</main>;
}
