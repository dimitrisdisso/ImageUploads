import { sortEventsNewestFirst } from '@/lib/editorial';
import { Button } from "@/components/ui/button";
import { SettingsText } from "@/components/settings-text";
import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { useSiteSettings } from "@/lib/cms";
import { useContent } from "@/lib/cms";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Clock } from "lucide-react";
import { formatDate } from "@/lib/content";

export const Route = createFileRoute("/ekdiloseis")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, 'Εκδηλώσεις', settings['eventsIntro']); return result; },
  component: Events,
});

function Events() {
  const settings = useSiteSettings();
  const {events}=useContent();
  const types = ["Όλες", ...new Set(events.map((e) => e.type))];
  const [t, setT] = useState("Όλες");
  const list = sortEventsNewestFirst(events).filter((e) => t === "Όλες" || e.type === t);
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="rule-heavy pt-4">
        <h1 className="text-5xl font-bold">Εκδηλώσεις</h1>
        <p className="mt-3 text-lg text-muted-foreground"><SettingsText name="eventsIntro"/></p>
      </header>
      <div className="mt-8 flex flex-wrap gap-2">
        {types.map((x) => (
          <Button key={x} variant={t === x ? "default" : "outline"} size="sm" onClick={() => setT(x)} aria-pressed={t === x}>{x}</Button>
        ))}
      </div>
      <ul className="mt-8 divide-y border-y">
        {list.map((e) => (
          <li key={e.id} className="grid gap-4 py-6 md:grid-cols-[140px_1fr]">
            <div>
              <p className="font-serif text-3xl font-bold text-primary">{new Date(e.date).getDate()}</p>
              <p className="text-sm">{formatDate(e.date).split(" ").slice(1).join(" ")}</p>
            </div>
            <div>
              {e.image && <Link to="/ekdilosi/$id" params={{id:e.id ?? ''}}><img src={e.image} alt={e.title} className="mb-4 aspect-[16/9] w-full max-w-md object-cover" loading="lazy"/></Link>}
              <p className="kicker">{e.type}</p>
              <h2 className="mt-1 text-2xl font-bold"><Link to="/ekdilosi/$id" params={{id:e.id ?? ''}} className="hover:text-primary hover:underline">{e.title}</Link></h2>
              <p className="mt-2 text-muted-foreground">{e.description}</p>
              <p className="mt-3 flex flex-wrap gap-4 text-sm"><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{e.time}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{e.place}</span></p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
