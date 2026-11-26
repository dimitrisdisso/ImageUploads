import { WriterProfile } from '@/components/writer-profile';
import { SettingsText } from "@/components/settings-text";
import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { createFileRoute, Link } from "@tanstack/react-router";
import walls from "@/assets/walls.jpg";
import { useContent, useSiteSettings } from "@/lib/cms";

export const Route = createFileRoute("/sxetika")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, settings['aboutTitle'], settings['aboutIntro']); return result; },
  component: About,
});

function About() {
  const {authors}=useContent();
  const settings = useSiteSettings();
  return (
    <main>
      <img src={walls} alt={settings['aboutImageAlt']} width={1200} height={800} className="h-[340px] w-full object-cover" />
      <div className="prose-article mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-6 font-serif text-5xl font-bold"><SettingsText name="aboutTitle"/></h1>
        <p className="whitespace-pre-line"><SettingsText name="aboutIntro"/></p>
        <h2><SettingsText name="aboutWorkTitle"/></h2>
        <p className="whitespace-pre-line"><SettingsText name="aboutWork"/></p>
        <h2><SettingsText name="aboutIndependenceTitle"/></h2>
        <p className="whitespace-pre-line"><SettingsText name="aboutIndependence"/></p>
        <h2><SettingsText name="aboutTeamTitle"/></h2>
        <ul className="not-prose grid gap-4 sm:grid-cols-2">
          {Object.values(authors).map((a) => (
            <li key={a.name} className="border p-4 font-sans"><p className="font-bold"><WriterProfile author={a}/></p><p className="text-sm text-muted-foreground">{a.role}</p></li>
          ))}
        </ul>
        <p className="mt-8">Έχετε μια ιστορία; <Link to="/apostoli" className="font-bold text-primary underline">Στείλτε μας τη</Link>.</p>
      </div>
    </main>
  );
}
