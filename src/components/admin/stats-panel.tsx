import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Bookmark, FileText, Heart, Loader2, MessageSquare, PenLine, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getStats } from '@/lib/admin.functions';
import { Button } from '@/components/ui/button';

type Counts = { published: number; users: number; comments: number; likes: number; saves: number };
type Stats = {
  totals: Counts & { drafts: number };
  period: Counts;
  previous: Counts;
  articles_series: { day: string; count: number }[];
  users_series: { day: string; count: number }[];
  top_articles: { slug: string; title: string; likes: number; saves: number; comments: number }[];
  recent_articles: { slug: string; title: string; date: string; status: string }[];
  recent_activity: { type: 'comment' | 'like' | 'save' | 'signup'; at: string; article?: string }[];
};

const RANGES = [
  [7, 'Τελευταίες 7 ημέρες'],
  [30, 'Τελευταίες 30 ημέρες'],
  [0, 'Από την αρχή'],
] as const;

export { bucketSeries } from '@/lib/stats';
import { bucketSeries } from '@/lib/stats';

export function StatsPanel({ titles }: { titles: Record<string, string> }) {
  const [days, setDays] = useState<number>(30);
  const stats = useQuery({
    queryKey: ['admin-stats', days],
    queryFn: async () => {
      return (await getStats({ data: { days } })) as unknown as Stats;
    },
    refetchInterval: 60_000,
  });
  const rangeLabel = RANGES.find(([d]) => d === days)?.[1] ?? '';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Χρονικό διάστημα">
        {RANGES.map(([d, l]) => <Button key={d} type="button" size="sm" variant={days === d ? 'default' : 'outline'} aria-pressed={days === d} onClick={() => setDays(d)}>{l}</Button>)}
        {stats.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ενημέρωση" />}
      </div>
      {stats.isPending ? (
        <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Φόρτωση στατιστικών…</p>
      ) : stats.error ? (
        <p role="alert">Τα στατιστικά δεν φορτώθηκαν. <Button variant="link" onClick={() => void stats.refetch()}>Δοκιμάστε ξανά</Button></p>
      ) : (
        <StatsBody s={stats.data} days={days} rangeLabel={rangeLabel} titles={titles} />
      )}
    </div>
  );
}

function StatsBody({ s, days, rangeLabel, titles }: { s: Stats; days: number; rangeLabel: string; titles: Record<string, string> }) {
  const cards: { key: keyof Counts | 'drafts'; label: string; icon: typeof FileText }[] = [
    { key: 'published', label: 'Δημοσιευμένα άρθρα', icon: FileText },
    { key: 'users', label: 'Εγγεγραμμένοι χρήστες', icon: Users },
    { key: 'comments', label: 'Σχόλια', icon: MessageSquare },
    { key: 'likes', label: 'Likes', icon: Heart },
    { key: 'saves', label: 'Αποθηκεύσεις', icon: Bookmark },
    { key: 'drafts', label: 'Προσχέδια', icon: PenLine },
  ];
  const activityLabel = { comment: 'Νέο σχόλιο', like: 'Νέο like', save: 'Νέα αποθήκευση', signup: 'Νέα εγγραφή χρήστη' } as const;
  return (
    <>
      <section aria-label="Βασικά μεγέθη">
        <p className="mb-3 text-xs text-muted-foreground">Ο μεγάλος αριθμός είναι το συνολικό μέγεθος. Η μικρή ένδειξη δείχνει τη δραστηριότητα στο διάστημα «{rangeLabel}»{days > 0 ? ' σε σύγκριση με το προηγούμενο ίδιο διάστημα' : ''}.</p>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map(({ key, label, icon: Icon }) => {
            const total = s.totals[key];
            const isDraft = key === 'drafts';
            const now = isDraft ? null : s.period[key as keyof Counts];
            const prev = isDraft ? null : s.previous[key as keyof Counts];
            const diff = now != null && prev != null ? now - prev : 0;
            return (
              <li key={key} className="border bg-background p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Icon className="size-4 text-primary" />{label}</p>
                <p className="mt-2 font-serif text-3xl font-bold">{total.toLocaleString('el-GR')}</p>
                {isDraft ? <p className="mt-1 text-xs text-muted-foreground">σε αναμονή δημοσίευσης</p> : (
                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-semibold">+{now} στο διάστημα</span>
                    {days > 0 && diff !== 0 && (
                      <span className={`inline-flex items-center ${diff > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {diff > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(diff)} από πριν
                      </span>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Δημοσιεύσεις άρθρων" subtitle={rangeLabel} data={bucketSeries(s.articles_series, days)} />
        <ChartCard title="Νέες εγγραφές χρηστών" subtitle={rangeLabel} data={bucketSeries(s.users_series, days)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="border bg-background lg:col-span-2">
          <h3 className="border-b px-5 py-3 font-sans text-sm font-bold">Άρθρα με τη μεγαλύτερη απήχηση <span className="font-normal text-muted-foreground">· {rangeLabel}</span></h3>
          {s.top_articles.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Δεν υπάρχει ακόμη δραστηριότητα αναγνωστών σε αυτό το διάστημα.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="px-5 py-2 font-semibold">Άρθρο</th><th className="px-2 py-2 text-right font-semibold">Likes</th><th className="px-2 py-2 text-right font-semibold">Αποθ.</th><th className="px-5 py-2 text-right font-semibold">Σχόλια</th></tr></thead>
                <tbody>{s.top_articles.slice(0, 8).map((a) => <tr key={a.slug} className="border-t"><td className="px-5 py-2.5">{a.title}</td><td className="px-2 text-right tabular-nums">{a.likes}</td><td className="px-2 text-right tabular-nums">{a.saves}</td><td className="px-5 text-right tabular-nums">{a.comments}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="border bg-background">
          <h3 className="border-b px-5 py-3 font-sans text-sm font-bold">Πρόσφατη δραστηριότητα</h3>
          <p className="px-5 pt-3 text-xs text-muted-foreground">Χωρίς στοιχεία ταυτότητας αναγνωστών.</p>
          {s.recent_activity.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Καμία δραστηριότητα ακόμη.</p> : (
            <ul className="divide-y px-5 py-2 text-sm">{s.recent_activity.slice(0, 10).map((a, i) => <li key={i} className="py-2"><span className="font-semibold">{activityLabel[a.type]}</span>{a.article && <span className="text-muted-foreground"> · {titles[a.article] ?? a.article}</span>}<span className="block text-xs text-muted-foreground">{new Date(a.at).toLocaleString('el-GR', { dateStyle: 'medium', timeStyle: 'short' })}</span></li>)}</ul>
          )}
        </section>
      </div>

      <section className="border bg-background">
        <h3 className="border-b px-5 py-3 font-sans text-sm font-bold">Πρόσφατα άρθρα</h3>
        <ul className="divide-y text-sm">{s.recent_articles.map((a) => <li key={a.slug} className="flex flex-wrap justify-between gap-2 px-5 py-2.5"><span className="min-w-0 flex-1">{a.title || 'Χωρίς τίτλο'}</span><span className="text-xs text-muted-foreground">{a.date ? new Date(a.date).toLocaleDateString('el-GR') : ''} · {a.status === 'published' ? 'Δημοσιευμένο' : 'Προσχέδιο'}</span></li>)}</ul>
      </section>
    </>
  );
}

function ChartCard({ title, subtitle, data }: { title: string; subtitle: string; data: { label: string; count: number }[] }) {
  const total = data.reduce((n, d) => n + d.count, 0);
  return (
    <section className="border bg-background p-5">
      <div className="flex items-baseline justify-between gap-2"><h3 className="font-sans text-sm font-bold">{title}</h3><span className="text-xs text-muted-foreground">{subtitle} · σύνολο {total}</span></div>
      {data.length === 0 || total === 0 ? <p className="mt-6 h-48 text-sm text-muted-foreground">Δεν υπάρχουν δεδομένα για αυτό το διάστημα.</p> : (
        <div className="mt-4 h-56 text-primary" role="img" aria-label={`${title}: ${total} συνολικά, ${subtitle}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} contentStyle={{ borderRadius: 4, fontSize: 12 }} formatter={(v) => [v, 'Πλήθος']} />
              <Bar isAnimationActive={false} dataKey="count" fill="currentColor" radius={[2, 2, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
