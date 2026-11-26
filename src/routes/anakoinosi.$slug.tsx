import { createFileRoute, notFound } from '@tanstack/react-router';
import { publicContent } from '@/lib/cms.functions';
import { settingsFromMatches } from '@/lib/site-settings';
import { formatDate } from '@/lib/content';
import { useContent } from '@/lib/cms';
import { WriterProfile } from '@/components/writer-profile';

export const Route = createFileRoute('/anakoinosi/$slug')({
  loader: async ({ params }) => { const bundle = await publicContent(); const item = bundle.announcements.find(a => a.slug === params.slug); if (!item) throw notFound(); return item; },
  head: ({ loaderData: a, matches }) => ({ meta: [
    { title: `${a?.title ?? 'Ανακοίνωση'} — ${settingsFromMatches(matches)['companyName']}` },
    { name: 'description', content: a?.subtitle ?? '' },
    { property: 'og:title', content: a?.title ?? 'Ανακοίνωση' },
    { property: 'og:description', content: a?.subtitle ?? '' },
    { property: 'og:type', content: 'article' },
    { name: 'twitter:card', content: 'summary_large_image' },
    ...(a?.image?.startsWith('https://') ? [{ property: 'og:image', content: a.image }, { name: 'twitter:image', content: a.image }] : []),
  ] }),
  component: AnnouncementPage,
});
function AnnouncementPage() {
  const a = Route.useLoaderData();
  const { authors } = useContent();
  const author = authors[a.author];
  return <main className="mx-auto max-w-4xl px-4 py-10"><p className="kicker">Πίνακας της γειτονιάς</p><h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">{a.title}</h1><p className="mt-4 text-xl text-muted-foreground">{a.subtitle}</p><div className="my-5 flex flex-wrap gap-3 text-sm text-muted-foreground">{author && <WriterProfile author={author}/>}<span>{a.date && formatDate(a.date)}</span></div>{a.image && <figure><img src={a.image} alt={a.title} className="aspect-video w-full object-cover"/>{a.photoCredit && <figcaption className="mt-2 text-xs text-muted-foreground">{a.photoCredit}</figcaption>}</figure>}<div className="article-body prose-article mt-8">{a.html ? <div dangerouslySetInnerHTML={{ __html: a.html }}/> : a.body.map((p,i)=><p key={i}>{p}</p>)}</div></main>;
}