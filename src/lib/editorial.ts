import { categories, type Event } from './content';

export type PublicationCategory = { slug: string; name: string; description: string; showOnHome: boolean; hidden?: boolean };
export function publicationCategories(custom: PublicationCategory[] = []) {
  const all: Record<string, PublicationCategory> = Object.fromEntries(Object.entries(categories).map(([slug, c]) => [slug, { ...c, slug, showOnHome: true }]));
  for (const category of custom) all[category.slug] = category;
  for (const slug of Object.keys(all)) if (all[slug]?.hidden) delete all[slug];
  return all;
}
export function categoryPath(slug: string) {
  return slug in categories ? `/${slug}` : `/enotita/${slug}`;
}
export function upcomingEvents(events: Event[], today: string) {
  return events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}
export function commentsAreEnabled(article: { commentsEnabled?: boolean }) {
  return article.commentsEnabled !== false;
}
export function athensToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function publicationError(kind: string, data: Record<string, any>, status: string) {
  if (status !== 'published') return '';
  const fields = kind === 'post' || kind === 'announcement' ? ['title', 'slug', 'date'] : kind === 'event' ? ['title', 'date', 'time', 'place', 'type'] : kind === 'author' ? ['name'] : kind === 'category' ? ['name', 'slug'] : [];
  if (fields.some(k => !String(data[k] ?? '').trim())) return 'Συμπληρώστε τα απαραίτητα στοιχεία πριν τη δημοσίευση.';
  if (['post', 'announcement'].includes(kind) && !String(data['html'] ?? '').replace(/<[^>]*>/g, '').trim() && !data['body']?.length && !String(data['html'] ?? '').includes('<img')) return 'Προσθέστε κείμενο πριν τη δημοσίευση.';
  if (['post', 'announcement', 'category'].includes(kind) && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data['slug'] ?? '')) return 'Ο σύνδεσμος δέχεται λατινικούς χαρακτήρες, αριθμούς και παύλες.';
  return '';
}
export function subscriptionData(email: string, consent: boolean) {
  if (!consent) throw new Error('Η συγκατάθεση είναι απαραίτητη.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Συμπληρώστε έγκυρο email.');
  return { email: email.trim().toLowerCase(), consent: true, consentVersion: 'newsletter-v1' };
}
export function requirePhotoCredit(credit: string) {
  if (!credit.trim()) throw new Error('Συμπληρώστε την πηγή / δημιουργό της φωτογραφίας.');
  return credit.trim();
}
export function sortEventsNewestFirst<T extends { date: string; time?: string }>(events: T[]) {
  return [...events].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
}
/** Built-in sections not yet stored in the CMS, so admins can edit or remove them. */
export function builtInCategoryRows(stored: { kind: string; data: unknown }[]) {
  const slugs = new Set(stored.filter(r => r.kind === 'category').map(r => (r.data as PublicationCategory).slug));
  return Object.entries(categories).filter(([slug]) => !slugs.has(slug)).map(([slug, c]) => ({ id: `category-${slug}`, kind: 'category', status: 'published', builtIn: true, data: { ...c, slug, showOnHome: true } as PublicationCategory }));
}
export function isBuiltInCategory(slug: string) { return slug in categories; }
export function unseenCount(rows: { kind: string; created_at: string }[], kind: string, lastSeen: string | null) {
  return rows.filter(r => r.kind === kind && (!lastSeen || r.created_at > lastSeen)).length;
}

/** Homepage lead: the admin-chosen article if it is still published, otherwise the newest. */
export function pickLead<T extends { slug: string }>(articles: T[], featuredSlug?: string): T | undefined {
  return (featuredSlug && articles.find(a => a.slug === featuredSlug)) || articles[0];
}
