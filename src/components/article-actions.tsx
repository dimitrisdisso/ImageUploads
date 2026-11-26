import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Bookmark, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getArticleActivity, getLikeCount, setArticleFlag } from '@/lib/reader.functions';
import { useReaderAuth } from '@/lib/reader-auth';
import { toast } from 'sonner';
import { ShareButton } from '@/components/share-button';
import { useContent } from '@/lib/cms';

export function ArticleActions({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const { articles } = useContent();
  const { user, loading } = useReaderAuth(); const qc = useQueryClient(); const [busy, setBusy] = useState(false);
  const count = useQuery({ queryKey: ['like-count', slug], queryFn: async () => Number(await getLikeCount({ data: { slug } })) });
  const activity = useQuery({ queryKey: ['article-activity', slug, user?.id], enabled: Boolean(user), queryFn: async () => {
    if (!user) return { saved: false, liked: false };
    return getArticleActivity({ data: { slug } });
  } });
  const toggle = async (kind: 'saved' | 'liked') => {
    if (!user || busy || activity.isPending || activity.error) return;
    setBusy(true);
    try {
      const active = activity.data?.[kind];
      await setArticleFlag({ data: { slug, kind, active: !active } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['article-activity', slug] }), qc.invalidateQueries({ queryKey: ['like-count', slug] }), qc.invalidateQueries({ queryKey: ['reader-library'] })]);
      if (kind === 'saved') toast.success(active ? 'Το άρθρο αφαιρέθηκε από τα αποθηκευμένα.' : 'Το άρθρο αποθηκεύτηκε.');
    } catch { toast.error('Η αλλαγή δεν αποθηκεύτηκε. Δοκιμάστε ξανά.'); } finally { setBusy(false); }
  };
  const disabled = loading || busy || Boolean(user && (activity.isPending || activity.error));
  return <div className="mt-3 flex flex-wrap items-center gap-2">{(['saved', 'liked'] as const).map(kind => {
    const active = activity.data?.[kind]; const Icon = kind === 'saved' ? Bookmark : Heart;
    const label = kind === 'saved' ? active ? 'Αφαίρεση από τα αποθηκευμένα' : 'Αποθήκευση άρθρου' : active ? 'Αφαίρεση like' : 'Μου αρέσει';
    const content = <><Icon className={`size-4 ${active ? 'fill-current' : ''}`}/>{!compact && <span>{kind === 'saved' ? active ? 'Αποθηκεύτηκε' : 'Αποθήκευση' : 'Μου αρέσει'}</span>}{kind === 'liked' && <span>{count.isPending ? '…' : count.error ? '—' : count.data ?? 0}</span>}</>;
    return !user && !loading ? <Button key={kind} variant="outline" size="sm" asChild title={label}><Link aria-label={label} to="/auth" search={{ mode: 'login', redirect: `/arthro/${slug}` }}>{content}</Link></Button> : <Button key={kind} size="sm" variant={active ? 'default' : 'outline'} disabled={disabled} aria-label={label} aria-pressed={Boolean(active)} title={label} onClick={() => { void toggle(kind); }}>{content}</Button>;
  })}<ShareButton slug={slug} title={articles.find(a => a.slug === slug)?.title ?? ''} compact={compact}/>{activity.error && <Button size="sm" variant="link" onClick={() => { void activity.refetch(); }}>Δοκιμάστε ξανά</Button>}</div>;
}
