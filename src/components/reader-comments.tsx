import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getArticleComments, postComment, removeComment, updateComment } from '@/lib/reader.functions';
import { useReaderAuth } from '@/lib/reader-auth';
import { canEditComment, commentSchema, commentFromRow, type ReaderComment } from '@/lib/reader';
import { toast } from 'sonner';

export function CommentItem({ comment: c }: { comment: ReaderComment }) {
  const { user } = useReaderAuth(); const qc = useQueryClient();
  const [editing, setEditing] = useState(false); const [text, setText] = useState(c.text); const [busy, setBusy] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = async () => { await qc.invalidateQueries({ queryKey: ['comments'] }); await qc.invalidateQueries({ queryKey: ['reader-comments'] }); };
  const save = async () => {
    const parsed = commentSchema.safeParse(text); if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    try { await updateComment({ data: { id: c.id, text: parsed.data } }); await refresh(); setEditing(false); toast.success('Το σχόλιο ενημερώθηκε.'); } catch { toast.error('Το σχόλιο δεν ενημερώθηκε.'); } finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); try { await removeComment({ data: { id: c.id } }); await refresh(); toast.success('Το σχόλιο διαγράφηκε.'); } catch { toast.error('Το σχόλιο δεν διαγράφηκε.'); } finally { setBusy(false); setConfirmDelete(false); } };
  return <li className="border-b py-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{c.name} <time className="ml-2 font-normal text-muted-foreground" dateTime={c.created_at}>{new Date(c.created_at).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' })}</time></p>{canEditComment(c, user?.id) && <div className="flex gap-1"><Button size="icon" variant="ghost" title="Επεξεργασία σχολίου" aria-label="Επεξεργασία σχολίου" disabled={busy} onClick={() => { setEditing(!editing); setText(c.text); }}><Pencil className="size-4"/></Button><Button size="icon" variant="ghost" title="Διαγραφή σχολίου" aria-label="Διαγραφή σχολίου" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4"/></Button></div>}</div>{c.status !== 'approved' && <p className="mt-1 text-xs text-primary">{c.status === 'archived' ? 'Στο αρχείο · Δεν εμφανίζεται δημόσια' : 'Σε αναμονή έγκρισης'}</p>}{editing ? <form className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); void save(); }}><textarea className="cms-input" aria-label="Επεξεργασία σχολίου" value={text} onChange={e => setText(e.target.value)} maxLength={1500} rows={4} required/><div className="flex gap-2"><Button disabled={busy} type="submit">{busy ? 'Αποθήκευση…' : 'Αποθήκευση'}</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Ακύρωση</Button></div></form> : <p className="mt-2 whitespace-pre-wrap break-words">{c.text}</p>}{confirmDelete && <div role="alert" className="mt-3 flex flex-wrap items-center gap-3"><span>Να διαγραφεί το σχόλιο;</span><Button size="sm" disabled={busy} onClick={() => { void remove(); }}>Διαγραφή</Button><Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Ακύρωση</Button></div>}</li>;
}
export function ReaderComments({ slug }: { slug: string }) {
  const { user, loading } = useReaderAuth(); const qc = useQueryClient(); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['comments', slug, user?.id], queryFn: async () => {
    return (await getArticleComments({ data: { slug } })).map(commentFromRow);
  } });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user || busy) return; const parsed = commentSchema.safeParse(text);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Ελέγξτε το σχόλιο.'); return; } setBusy(true); setError('');
    try { await postComment({ data: { slug, text: parsed.data } }); setText(''); await qc.invalidateQueries({ queryKey: ['comments'] }); await qc.invalidateQueries({ queryKey: ['reader-comments'] }); toast.success('Το σχόλιό σας δημοσιεύτηκε.'); } catch (e) { const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : ''; setError(message.includes('30') ? 'Περιμένετε 30 δευτερόλεπτα πριν στείλετε νέο σχόλιο.' : 'Το σχόλιο δεν στάλθηκε. Δοκιμάστε ξανά.'); } finally { setBusy(false); }
  };
  return <section className="mx-auto mt-8 max-w-3xl px-4"><div className="rule-heavy pt-3"><h2 className="text-2xl font-bold">Σχόλια αναγνωστών ({query.data?.filter(c => c.status === 'approved').length ?? 0})</h2>{query.isPending ? <p role="status" className="mt-5">Φόρτωση σχολίων…</p> : query.error ? <p role="alert" className="mt-5">Τα σχόλια δεν φορτώθηκαν. <Button variant="link" onClick={() => { void query.refetch(); }}>Δοκιμάστε ξανά</Button></p> : <ul>{query.data?.map(c => <CommentItem key={c.id} comment={c}/>)}</ul>}{!query.isPending && !query.error && query.data?.length === 0 && <p className="mt-4 text-muted-foreground">Δεν υπάρχουν ακόμη σχόλια.</p>}{loading ? <p className="mt-5">Φόρτωση λογαριασμού…</p> : user ? <form onSubmit={submit} className="mt-6 space-y-3"><label className="block text-sm font-semibold">Το σχόλιό σας<textarea aria-label="Το σχόλιό σας" required value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={1500} className="cms-input mt-2"/></label><Button disabled={busy} type="submit">{busy ? 'Αποστολή…' : 'Αποστολή σχολίου'}</Button>{error && <p role="alert" className="text-sm text-primary">{error}</p>}</form> : <p className="mt-6 text-sm"><Link to="/auth" search={{ mode: 'login', redirect: `/arthro/${slug}` }} className="font-bold text-primary underline">Συνδεθείτε</Link> ή <Link to="/auth" search={{ mode: 'register', redirect: `/arthro/${slug}` }} className="font-bold text-primary underline">δημιουργήστε λογαριασμό</Link> για να σχολιάσετε.</p>}</div></section>;
}
