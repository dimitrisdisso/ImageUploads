import { WriterProfile } from '@/components/writer-profile';
import { pickLead, athensToday, upcomingEvents, categoryPath } from '@/lib/editorial';
import { ArticleActions } from "@/components/article-actions";
import { SettingsText } from "@/components/settings-text";
import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Megaphone, Camera, CalendarDays } from "lucide-react";
import { ArticleCard, Newsletter, SectionTitle } from "@/components/site";
import { categories, formatDate } from "@/lib/content";

import { useContent, useSiteSettings, useCategories } from "@/lib/cms";

export const Route = createFileRoute("/")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, settings['homeTitle'], settings['siteDescription']); return result; },
  component: Index,
});

function Index() {
  const {articles,authors,events,announcements}=useContent();
  const settings = useSiteSettings();
  const sections=useCategories();
  const lead = pickLead(articles, settings['featuredSlug']);
  if(!lead)return <main><div className="mx-auto max-w-7xl px-5 py-12"><h1 className="text-3xl font-bold"><SettingsText name="companyName"/></h1><p className="mt-5"><SettingsText name="emptyText"/></p><section className="mt-10"><SectionTitle>Πίνακας της γειτονιάς</SectionTitle>{announcements.slice(0,5).map(a=><Link key={a.id} to="/anakoinosi/$slug" params={{slug:a.slug}} className="block border-b py-4 font-semibold">{a.title}</Link>)}{upcomingEvents(events,athensToday()).map(e=><Link key={e.id} to="/ekdilosi/$id" params={{id:e.id??''}} className="block border-b py-4 font-semibold">{e.title} · {formatDate(e.date)}</Link>)}</section><section className="mt-10"><SectionTitle to="/ekdiloseis">Εκδηλώσεις</SectionTitle>{upcomingEvents(events,athensToday()).slice(0,3).map(e=><Link key={e.id} to="/ekdilosi/$id" params={{id:e.id??''}} className="block border-b py-4">{e.title} · {formatDate(e.date)}</Link>)}</section></div><Newsletter/></main>;
  const others = articles.filter(a=>a!==lead);

  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-b pb-4 text-xs"><span className="kicker">Στο επίκεντρο</span>{settings['focusNeighborhoodLink'] ? <span className="font-semibold"><SettingsText name="focusNeighborhood"/></span> : <Link to="/geitonia" className="font-semibold">{settings['focusNeighborhood']}</Link>}{settings['focusHistoryLink'] ? <span className="font-semibold"><SettingsText name="focusHistory"/></span> : <Link to="/istoria" className="font-semibold">{settings['focusHistory']}</Link>}<Link to="/ekdiloseis" className="font-semibold">Το ημερολόγιο μας ↗</Link></div>
        <div className="frontpage-grid">
          <aside className="frontpage-briefs space-y-6">{others.slice(0,2).map(a=><ArticleCard key={a.slug} a={a}/>)}</aside>
          <article className="frontpage-lead group"><Link to="/arthro/$slug" params={{slug:lead.slug}}><img src={lead.image} alt={lead.title} className="aspect-[4/3] w-full object-cover"/></Link><Link to={categoryPath(lead.category)} className="kicker mt-5 inline-block">{sections[lead.category]?.name ?? lead.category}</Link><h1 className="mt-2 text-3xl font-extrabold leading-tight text-primary md:text-4xl"><Link to="/arthro/$slug" params={{slug:lead.slug}}>{lead.title}</Link></h1><p className="mt-3 font-serif text-lg leading-relaxed">{lead.subtitle}</p><p className="mt-4 text-xs text-muted-foreground"><strong className="text-primary">{authors[lead.author]?<WriterProfile author={authors[lead.author]}/>: 'Συντακτική ομάδα'}</strong> · {formatDate(lead.date)}</p><ArticleActions slug={lead.slug} compact/></article>
          <aside className="frontpage-community"><div className="border-t-4 border-secondary bg-paper p-6"><p className="kicker"><SettingsText name="communityEyebrow"/></p><h2 className="mt-3 text-2xl font-bold"><SettingsText name="communityTitle"/></h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground"><SettingsText name="communityText"/></p><Link to="/" hash="newsletter" className="mt-5 block bg-secondary px-3 py-3 text-center text-sm font-bold text-secondary-foreground">Λάβετε το ενημερωτικό μας →</Link></div><div className="mt-7"><p className="rule-heavy pt-3 text-lg font-bold"><SettingsText name="boardTitle"/></p><ul className="mt-3 divide-y">{announcements.slice(0,5).map(a=><li key={a.id} className="py-3 text-sm leading-relaxed"><Link to="/anakoinosi/$slug" params={{slug:a.slug}} className="hover:text-primary hover:underline">{a.title}</Link></li>)}{upcomingEvents(events,athensToday()).slice(0,5).map(e=><li key={e.id} className="py-3 text-sm leading-relaxed"><Link to="/ekdilosi/$id" params={{id:e.id??''}} className="hover:text-primary hover:underline"><span className="kicker mr-2">{formatDate(e.date)}</span>{e.title}</Link></li>)}</ul></div></aside>
        </div>

        <section className="mt-14">
          <SectionTitle>Πρόσφατα</SectionTitle>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {others.slice(2,5).map((a) => <ArticleCard key={a.slug} a={a} />)}
          </div>
        </section>

        <section className="mt-14 grid gap-6 bg-ink p-8 text-ink-foreground md:grid-cols-[auto_1fr_auto] md:items-center md:p-10">
          <Camera className="h-10 w-10 text-primary-foreground" />
          <div>
            <h2 className="text-2xl font-bold"><SettingsText name="tipTitle"/></h2>
            <p className="mt-1 opacity-80"><SettingsText name="tipText"/></p>
          </div>
          <Link to="/apostoli" className="bg-primary px-6 py-3 text-center font-bold text-primary-foreground hover:opacity-90">Στείλτε είδηση</Link>
        </section>

        <div className="mt-14 grid gap-12 lg:grid-cols-2">
          {Object.values(sections).filter(c=>c.showOnHome).map((section) => (
            <section key={section.slug}>
              <SectionTitle to={categoryPath(section.slug)}>{section.name}</SectionTitle>
              <div className="grid gap-8 sm:grid-cols-2">
                {articles.filter(a=>a.category===section.slug).slice(0, 2).map((a) => <ArticleCard key={a.slug} a={a} />)}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-14">
          <SectionTitle to="/ekdiloseis">Εκδηλώσεις</SectionTitle>
          <div className="grid gap-6 md:grid-cols-3">
            {upcomingEvents(events,athensToday()).slice(0, 3).map((e) => (
              <Link key={e.id} to="/ekdilosi/$id" params={{id:e.id ?? ''}} className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border p-5 hover:bg-muted">
                <div className="text-center">
                  <CalendarDays className="mx-auto h-5 w-5 text-primary" />
                  <p className="mt-1 font-serif text-2xl font-bold">{new Date(e.date).getDate()}</p>
                  <p className="text-xs uppercase">{new Date(e.date).toLocaleDateString("el-GR", { month: "short" })}</p>
                </div>
                <div>
                  <p className="kicker">{e.type}</p>
                  <p className="mt-1 font-serif font-bold leading-snug">{e.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{e.time} · {e.place}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <Newsletter />
    </main>
  );
}
