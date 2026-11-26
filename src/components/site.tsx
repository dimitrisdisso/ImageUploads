import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Search, Menu, X, Mail, Facebook, Instagram } from "lucide-react";
import { categories, formatDate, type Article } from "@/lib/content";

import { useContent, useSiteSettings, useCategories } from "@/lib/cms";
import { subscribeNewsletter } from "@/lib/reader.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReaderAccountMenu } from "@/components/reader-account-menu";
import { safeSocialUrl } from "@/lib/site-settings";
import { SettingsText } from "@/components/settings-text";
import { WriterProfile } from '@/components/writer-profile';
import { categoryPath, subscriptionData } from '@/lib/editorial';
import { ArticleActions } from "@/components/article-actions";

const nav = [
  { to: "/nea", label: "Νέα" },
  { to: "/geitonia", label: "Γειτονιά" },
  { to: "/politismos", label: "Πολιτισμός" },
  { to: "/istoria", label: "Ιστορία" },
  { to: "/apopseis", label: "Απόψεις" },
  { to: "/ekdiloseis", label: "Εκδηλώσεις" },
  { to: "/sxetika", label: "Σχετικά με εμάς" },
] as const;

export function Logo() {
  const settings = useSiteSettings();
  return <div className="masthead-logo"><span className="masthead-small"><SettingsText name="slogan"/></span><span className="masthead-name break-words">{safeSocialUrl(settings['companyNameLink']) ? <SettingsText name="companyName"/> : <Link to="/">{settings['companyName']}</Link>}</span></div>;
}
export function SiteHeader() {
 const settings = useSiteSettings();
 const sections = useCategories();
 const [open,setOpen]=useState(false); const [q,setQ]=useState("");const [searchOpen,setSearchOpen]=useState(false); const navigate=useNavigate();
 return <header className="publication-header bg-ink text-ink-foreground"><div className="mx-auto max-w-7xl px-5"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ink-foreground/15 py-3 text-xs"><span><span className="hidden sm:inline"><SettingsText name="headerDescription"/> · </span><SettingsText name="location"/></span><div className="flex flex-wrap items-center justify-end gap-2"><ReaderAccountMenu/><Link to="/sxetika" className="hidden sm:block">Ποιοι είμαστε</Link><Link to="/apostoli">Στείλτε μια είδηση ↗</Link></div></div><div className="masthead-row"><div className="hidden whitespace-pre-line text-xs leading-relaxed opacity-75 lg:block"><SettingsText name="headerTagline"/></div><Logo/><div className="flex shrink-0 items-center gap-2"><Button asChild className="hidden bg-secondary text-secondary-foreground hover:bg-secondary/90 sm:inline-flex"><Link to="/" hash="newsletter">Το ενημερωτικό μας</Link></Button><Button variant="ghost" size="icon" title="Αναζήτηση" aria-label="Αναζήτηση" onClick={()=>setSearchOpen(!searchOpen)}><Search/></Button><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Μενού" aria-expanded={open} aria-controls="publication-navigation" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</Button></div></div>{searchOpen&&<form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pb-5" onSubmit={e=>{e.preventDefault();navigate({to:'/anazitisi',search:{q,c:''}});setSearchOpen(false);}}><input aria-label="Αναζητήστε άρθρα" autoFocus className="cms-input text-foreground" value={q} onChange={e=>setQ(e.target.value)} placeholder="Αναζητήστε άρθρα…"/><Button type="submit">Αναζήτηση</Button></form>}</div><nav id="publication-navigation" className={`${open?'block':'hidden'} masthead-nav lg:block`}><ul className="mx-auto flex max-w-7xl flex-col px-5 lg:flex-row lg:justify-center lg:gap-9">{[...Object.values(sections).map(c=>({to:categoryPath(c.slug),label:c.name})),...nav.filter(n=>!Object.keys(categories).some(c=>n.to===`/${c}`))].map(n=><li key={n.to}><Link to={n.to} onClick={()=>setOpen(false)} className="block py-3 text-sm font-bold hover:text-secondary" activeProps={{className:'text-secondary'}}>{n.label}</Link></li>)}</ul></nav></header>;
}

export function ArticleCard({ a, size = "md" }: { a: Article; size?: "sm" | "md" | "lg" }) {
  const { authors } = useContent();
  const sections=useCategories();
  return (
    <article className="group">
      {size !== "sm" && (
        <Link to="/arthro/$slug" params={{ slug: a.slug }} className="block overflow-hidden">
          <img src={a.image} alt="" loading="lazy" width={1200} height={800} className="aspect-[3/2] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </Link>
      )}
      <div className={size !== "sm" ? "mt-3" : ""}>
        <Link to={categoryPath(a.category)} className="kicker">{sections[a.category]?.name ?? a.category}</Link>
        <h3 className={`mt-1 font-bold leading-snug group-hover:text-primary ${size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl"}`}>
          <Link to="/arthro/$slug" params={{ slug: a.slug }}>{a.title}</Link>
        </h3>
        {size !== "sm" && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.subtitle}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {authors[a.author] ? <WriterProfile author={authors[a.author]}/> : "Συντακτική ομάδα"} · {formatDate(a.date)}
        </p>
        <ArticleActions slug={a.slug} compact/>
      </div>
    </article>
  );
}

export function SectionTitle({ children, to }: { children: string; to?: string }) {
  return (
    <div className="rule-heavy mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 pt-3">
      <h2 className="text-2xl font-bold">{children}</h2>
      {to && <Link to={to} className="text-sm font-bold text-primary hover:underline">Όλα →</Link>}
    </div>
  );
}

export function Newsletter() {
  const settings = useSiteSettings();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy,setBusy] = useState(false);
  return (
    <section id="newsletter" className="bg-paper">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center">
        <div>
          <Mail className="h-8 w-8 text-primary" />
          <h2 className="mt-3 text-3xl font-bold"><SettingsText name="newsletterTitle"/></h2>
          <p className="mt-2 text-muted-foreground"><SettingsText name="newsletterText"/></p>
        </div>
        {done ? (
          <p className="border-l-4 border-primary bg-background p-4 font-semibold">Ευχαριστούμε! Η εγγραφή σας καταχωρίστηκε.</p>
        ) : (
          <form onSubmit={async (e) => { e.preventDefault(); if(!consent)return; setBusy(true); try { const data=subscriptionData(email,consent); await subscribeNewsletter({data:{email:data.email,consent:true}}); setDone(true); } catch { toast.error("Η εγγραφή απέτυχε. Δοκιμάστε ξανά."); } finally { setBusy(false); } }} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Η διεύθυνση email σας" className="min-w-0 flex-1 border border-input bg-background px-4 py-3 outline-none focus:border-primary" />
            <label className="col-span-2 row-start-2 flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 size-4 shrink-0"/>Συμφωνώ να λαμβάνω το ενημερωτικό δελτίο μέσω email.</label>
            <Button disabled={busy || !consent} type="submit" className="h-12 px-6">Εγγραφή</Button>
          </form>
        )}
      </div>
    </section>
  );
}

export function SiteFooter() {
  const settings=useSiteSettings();
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-2xl font-bold"><SettingsText name="companyName"/></p>
          <p className="mt-3 max-w-md text-sm opacity-80">
            <SettingsText name="footerDescription"/>
          </p>
          <div className="mt-5 flex gap-3">
            {safeSocialUrl(settings['facebook']) && <a href={safeSocialUrl(settings['facebook'])} aria-label="Facebook" className="rounded border border-ink-foreground/30 p-2 hover:bg-ink-foreground/10"><Facebook className="h-4 w-4" /></a>}
            {safeSocialUrl(settings['instagram']) && <a href={safeSocialUrl(settings['instagram'])} aria-label="Instagram" className="rounded border border-ink-foreground/30 p-2 hover:bg-ink-foreground/10"><Instagram className="h-4 w-4" /></a>}
          </div>
        </div>
        <div>
          <p className="kicker text-ink-foreground">Ενότητες</p>
          <ul className="mt-3 space-y-2 text-sm opacity-80">
            {nav.map((n) => <li key={n.to}><Link to={n.to} className="hover:underline">{n.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="kicker text-ink-foreground">Επικοινωνία</p>
          <ul className="mt-3 space-y-2 text-sm opacity-80">
            {settings['address'] && <li><SettingsText name="address"/></li>}
            {settings['email'] && <li><SettingsText name="email"/></li>}
            {settings['phone'] && <li><SettingsText name="phone"/></li>}
            <li><Link to="/apostoli" className="font-semibold underline">Στείλτε είδηση ή φωτογραφία</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-foreground/15 py-4 text-center text-xs opacity-60">
        © {new Date().getFullYear()} <SettingsText name="companyName"/>. <SettingsText name="copyrightText"/>
      </div>
    </footer>
  );
}

export function CategoryPage({ slug }: { slug: string }) {
  const settings = useSiteSettings();
  const {articles}=useContent();
  const sections=useCategories();
  const list = articles.filter((a) => a.category === slug);
  const [lead, ...rest] = list;
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <header className="rule-heavy mb-10 pt-4">
        <h1 className="text-3xl font-bold sm:text-5xl">{sections[slug]?.name ?? slug}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{sections[slug]?.description}</p>
      </header>
      {lead && (
        <div className="mb-12 grid gap-8 border-b pb-12 md:grid-cols-2">
          <img src={lead.image} alt="" width={1200} height={800} className="aspect-[3/2] w-full object-cover" />
          <ArticleCard a={lead} size="sm" />
        </div>
      )}
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => <ArticleCard key={a.slug} a={a} />)}
      </div>
      {list.length <= 1 && <p className="text-muted-foreground">Περισσότερα άρθρα σύντομα.</p>}
    </main>
  );
}
