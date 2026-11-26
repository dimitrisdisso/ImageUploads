import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Clock, MapPin, CalendarDays, ArrowLeft } from 'lucide-react';
import { publicContent } from '@/lib/cms.functions';
import { bundledImages } from '@/lib/cms';
import { companyHead } from '@/lib/site-settings';
import { formatDate } from '@/lib/content';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/ekdilosi/$id')({
  loader: async ({ params }) => {
    const content = await publicContent();
    const event = content.events.find(event => event.id === params.id);
    if (!event) throw notFound();
    return event;
  },
  head: ({ matches, loaderData }) => {
    const head = companyHead(matches, loaderData?.title ?? 'Εκδήλωση', loaderData?.description);
    if (loaderData?.image?.startsWith('https://')) head.meta.push({ property: 'og:image', content: loaderData.image }, { name: 'twitter:image', content: loaderData.image });
    return head;
  },
  component: EventPage,
});

function EventPage() {
  const event = Route.useLoaderData();
  const image = event.image ? bundledImages[event.image] ?? event.image : '';
  return <main className="mx-auto max-w-4xl px-4 py-10">
    <Button variant="link" className="mb-6 px-0" asChild><Link to="/ekdiloseis"><ArrowLeft/>Εκδηλώσεις</Link></Button>
    <p className="kicker">{event.type}</p>
    <h1 className="mt-3 break-words text-3xl font-bold leading-tight sm:text-5xl">{event.title}</h1>
    <p className="mt-4 whitespace-pre-line text-xl text-muted-foreground">{event.description}</p>
    <div className="my-6 flex flex-wrap gap-4 border-y py-4 text-sm">
      <span className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0"/>{formatDate(event.date)}</span>
      <span className="flex items-center gap-2"><Clock className="size-4 shrink-0"/>{event.time}</span>
      <span className="flex items-center gap-2"><MapPin className="size-4 shrink-0"/>{event.place}</span>
    </div>
    {image && <img src={image} alt={event.title} className="mb-8 max-h-[640px] w-full object-contain"/>}
    {event.html && <div className="prose-article article-body" dangerouslySetInnerHTML={{__html:event.html}}/>}
  </main>;
}