import { SettingsText } from "@/components/settings-text";
import { settingsFromMatches } from "@/lib/site-settings";
import { useSiteSettings } from "@/lib/cms";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArticleCard } from "@/components/site";
import { categories, formatDate } from "@/lib/content";

import { publicContent } from "@/lib/cms.functions";
import { useContent, bundledImages, useCategories } from "@/lib/cms";
import { ArticleActions } from "@/components/article-actions";
import { WriterProfile } from '@/components/writer-profile';
import { categoryPath, commentsAreEnabled } from '@/lib/editorial';
import { ReaderComments } from "@/components/reader-comments";



export const Route = createFileRoute("/arthro/$slug")({
  loader: async ({ params }) => {
    const content=await publicContent();
    const a = content.articles.find(a=>a.slug===params.slug);
    if (!a) throw notFound();
    return a;
  },
  head: ({ loaderData, matches }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — ${settingsFromMatches(matches)['companyName']}` },
          { name: "description", content: loaderData.subtitle },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.subtitle },
          { property: "og:type", content: "article" },
          { property: "og:url", content: `/arthro/${loaderData.slug}` },
          { name:"twitter:card",content:"summary_large_image" },
          ...(loaderData.image.startsWith("https://") ? [{property:"og:image",content:loaderData.image},{name:"twitter:image",content:loaderData.image}] : []),
        ]
      : [{ title: "Δεν βρέθηκε" }, { name: "robots", content: "noindex" }],
  }),
  component: ArticlePage,
});


function ArticlePage() {
  const settings = useSiteSettings();
  const raw = Route.useLoaderData();
  const a={...raw,image:bundledImages[raw.image]??raw.image};
  const {articles,authors}=useContent();
  const sections=useCategories();
  const author = authors[a.author] ?? {name:"Συντακτική ομάδα",role:""};
  const related = articles.filter((x) => x.slug !== a.slug && x.category === a.category).concat(articles.filter((x) => x.slug !== a.slug && x.category !== a.category)).slice(0, 3);
  return (
    <main>
      <article className="mx-auto max-w-3xl px-4 pt-10">
        <Link to={categoryPath(a.category)} className="kicker">{sections[a.category]?.name ?? a.category}</Link>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">{a.title}</h1>
        <p className="mt-4 text-xl leading-relaxed text-muted-foreground">{a.subtitle}</p>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-y py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary font-serif text-lg font-bold text-primary-foreground">{author.image?<img src={author.image} alt="" className="size-11 rounded-full object-cover"/>:author.name[0]}</div>
            <div>
              <p className="text-sm font-bold"><WriterProfile author={author}/></p>
              <p className="text-xs text-muted-foreground">{author.role} · {formatDate(a.date)}</p>
            </div>
          </div>

        </div>
        <ArticleActions slug={a.slug}/>
      </article>
      <figure className="mx-auto mt-8 max-w-5xl px-4">
        <img src={a.image} alt="" width={1600} height={1000} className="aspect-[16/9] w-full object-cover" />
        <figcaption className="mt-2 text-xs text-muted-foreground">Φωτογραφία: {a.photoCredit || settings["photoCredit"]}</figcaption>
      </figure>
      {a.html ? (
        <div className="prose-article article-body mx-auto mt-10 max-w-3xl px-4" dangerouslySetInnerHTML={{ __html: a.html }} />
      ) : (
      <div className="prose-article mx-auto mt-10 max-w-3xl px-4">
        {a.body.map((p, i) =>
          p.startsWith("## ") ? <h2 key={i}>{p.slice(3)}</h2> : p.startsWith("> ") ? <blockquote key={i}>{p.slice(2)}</blockquote> : <p key={i}>{p}</p>,
        )}
      </div>
      )}

      {commentsAreEnabled(a) && <ReaderComments slug={a.slug}/>}

      <section className="mx-auto mt-16 max-w-7xl px-4 pb-16">
        <div className="rule-heavy mb-6 pt-3"><h2 className="text-2xl font-bold">Σχετικά άρθρα</h2></div>
        <div className="grid gap-10 md:grid-cols-3">{related.map((r) => <ArticleCard key={r.slug} a={r} />)}</div>
      </section>
    </main>
  );
}
