import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { useSiteSettings } from "@/lib/cms";
import { useContent, useCategories } from "@/lib/cms";
import { Button } from '@/components/ui/button';
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArticleCard } from "@/components/site";
import { categories, type CategorySlug } from "@/lib/content";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const Route = createFileRoute("/anazitisi")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"] : "", c: typeof s["c"] === "string" ? s["c"] : "" }),
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, 'Αναζήτηση'); return result; },
  component: SearchPage,
});

function SearchPage() {
  const settings = useSiteSettings();
  const {articles}=useContent();
  const sections=useCategories();
  const { q, c } = Route.useSearch();
  const navigate = useNavigate({ from: "/anazitisi" });
  const [input, setInput] = useState(q);
  const results = articles.filter(
    (a) => (!c || a.category === c) && (!q || norm(`${a.title} ${a.subtitle} ${a.body.join(" ")}`).includes(norm(q))),
  );
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-4xl font-bold">Αναζήτηση</h1>
      <form onSubmit={(e) => { e.preventDefault(); navigate({ search: { q: input, c } }); }} className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={120} aria-label="Αναζήτηση" placeholder={settings['searchPlaceholder']} className="min-w-0 flex-1 border border-input px-4 py-3 outline-none focus:border-primary" />
        <Button type="submit" className="h-12 shrink-0">Αναζήτηση</Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {([["", "Όλες"], ...Object.entries(sections).map(([k, v]) => [k, v.name])] as [string, string][]).map(([k, label]) => (
          <Button key={k} variant={c===k?'default':'outline'} onClick={() => navigate({ search: { q, c: k } })}>{label}</Button>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">{results.length} αποτελέσματα</p>
      <div className="mt-6 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">{results.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
    </main>
  );
}
