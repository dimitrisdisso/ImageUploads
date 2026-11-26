import { categories } from './content';

export const settingsGroups = [
  { title: 'Ταυτότητα επιχείρησης', fields: [
    ['companyName', 'Όνομα επιχείρησης', 'Επιτροπή Άνω Πόλης'],
    ['slogan', 'Σύνθημα', 'Η ΦΩΝΗ ΤΗΣ ΓΕΙΤΟΝΙΑΣ'],
    ['headerDescription', 'Σύντομη περιγραφή στην κεφαλίδα', 'Ανεξάρτητη δημοσιογραφία'],
    ['location', 'Πόλη / περιοχή', 'Θεσσαλονίκη'],
    ['headerTagline', 'Κείμενο δίπλα στο όνομα', 'Οι άνθρωποι. Οι ιστορίες.\nΗ δική μας Άνω Πόλη.'],
    ['footerDescription', 'Περιγραφή στο κάτω μέρος', 'Ανεξάρτητο, μη κερδοσκοπικό μέσο τοπικής δημοσιογραφίας για την Άνω Πόλη της Θεσσαλονίκης. Γράφουμε για τη γειτονιά, με τη γειτονιά.'],
    ['copyrightText', 'Κείμενο πνευματικών δικαιωμάτων', 'Με την υποστήριξη των αναγνωστών μας.'],
    ['photoCredit', 'Προεπιλεγμένη αναφορά φωτογραφιών', 'Επιτροπή Άνω Πόλης'],
  ] },
  { title: 'Επικοινωνία', fields: [
    ['email', 'Email επικοινωνίας', '', 'email'], ['phone', 'Τηλέφωνο', '', 'tel'],
    ['address', 'Διεύθυνση', ''], ['facebook', 'Facebook', '', 'url'], ['instagram', 'Instagram', '', 'url'],
  ] },
  { title: 'Αρχική σελίδα', fields: [
    ['homeTitle', 'Τίτλος αρχικής για αναζήτηση και κοινοποίηση', 'Τοπικά νέα από την Άνω Πόλη Θεσσαλονίκης'],
    ['siteDescription', 'Περιγραφή για αναζήτηση και κοινοποίηση', 'Ανεξάρτητη δημοσιογραφία γειτονιάς για την Άνω Πόλη Θεσσαλονίκης.'],
    ['emptyText', 'Κείμενο όταν δεν υπάρχουν άρθρα', 'Τα νέα της γειτονιάς σύντομα κοντά σας.'],
    ['focusNeighborhood', 'Σύνδεσμος γειτονιάς', 'Η ζωή στη γειτονιά'],
    ['focusHistory', 'Σύνδεσμος ιστορίας', 'Οι μνήμες της Άνω Πόλης'],
    ['communityEyebrow', 'Μικρός τίτλος κοινότητας', 'Μαζί, στη γειτονιά'],
    ['communityTitle', 'Τίτλος κοινότητας', 'Η Άνω Πόλη έχει φωνή.'],
    ['communityText', 'Κείμενο κοινότητας', 'Νέα και ιστορίες από τους ανθρώπους που ζουν εδώ.'],
    ['boardTitle', 'Τίτλος ανακοινώσεων', 'Ο πίνακας της γειτονιάς'],
    ['tipTitle', 'Τίτλος πρόσκλησης για είδηση', 'Έχετε κάτι να μας πείτε;'],
    ['tipText', 'Κείμενο πρόσκλησης για είδηση', 'Ένα πρόβλημα στον δρόμο σας, μια ιστορία, μια φωτογραφία. Οι καλύτερες ειδήσεις ξεκινούν από τους κατοίκους.'],
  ] },
  { title: 'Ενημερωτικό δελτίο', fields: [
    ['newsletterAdminEmail', 'Email ειδοποιήσεων συνδρομητών', '', 'email'],
    ['newsletterTitle', 'Τίτλος ενημερωτικού', 'Η γειτονιά στο email σας'],
    ['newsletterText', 'Περιγραφή ενημερωτικού', 'Κάθε Παρασκευή, τα σημαντικότερα της εβδομάδας από την Άνω Πόλη. Δωρεάν, χωρίς διαφημίσεις.'],
  ] },
  { title: 'Πολυμέσα (GitHub + jsDelivr)', fields: [
    ['mediaGithubUser', 'Όνομα χρήστη GitHub (δημόσιο αποθετήριο πολυμέσων)', ''],
    ['mediaGithubRepo', 'Όνομα αποθετηρίου GitHub', ''],
    ['mediaRef', 'Έκδοση (tag ή branch) – προτείνεται tag, π.χ. v1', 'main'],
  ] },
  { title: 'Σχετικά με εμάς', fields: [
    ['aboutTitle', 'Τίτλος σελίδας', 'Σχετικά με εμάς'],
    ['aboutIntro', 'Παρουσίαση', 'Η «Επιτροπή Άνω Πόλης» είναι ένα ανεξάρτητο, μη κερδοσκοπικό μέσο ενημέρωσης που δημιουργήθηκε από κατοίκους και δημοσιογράφους της περιοχής. Πιστεύουμε ότι κάθε γειτονιά αξίζει τη δική της φωνή.'],
    ['aboutWorkTitle', 'Τίτλος δραστηριότητας', 'Τι κάνουμε'],
    ['aboutWork', 'Δραστηριότητα', 'Καλύπτουμε τα ζητήματα που αφορούν την καθημερινή ζωή στην Άνω Πόλη: δημόσιους χώρους, στέγαση, πολιτισμό, ιστορία και τις αποφάσεις του δήμου που μας επηρεάζουν. Ελέγχουμε τα στοιχεία, ακούμε όλες τις πλευρές και διορθώνουμε δημόσια τα λάθη μας.'],
    ['aboutIndependenceTitle', 'Τίτλος ανεξαρτησίας', 'Ανεξαρτησία'],
    ['aboutIndependence', 'Ανεξαρτησία / χρηματοδότηση', 'Δεν ανήκουμε σε κόμμα, επιχειρηματικό όμιλο ή δημοτική παράταξη. Χρηματοδοτούμαστε από συνδρομές αναγνωστών και μικρές δωρεές.'],
    ['aboutTeamTitle', 'Τίτλος ομάδας', 'Η ομάδα'],
    ['aboutImageAlt', 'Περιγραφή φωτογραφίας', 'Τα τείχη της Άνω Πόλης'],
  ] },
  { title: 'Σελίδες και ενότητες', fields: [
    ['contactTitle', 'Τίτλος αποστολής μηνύματος', 'Στείλτε μας την ιστορία σας'],
    ['contactIntro', 'Περιγραφή αποστολής μηνύματος', 'Ένα πρόβλημα στη γειτονιά, μια ιδέα για ρεπορτάζ, μια φωτογραφία. Διαβάζουμε κάθε μήνυμα και προστατεύουμε την ανωνυμία σας αν το ζητήσετε.'],
    ['eventsIntro', 'Περιγραφή εκδηλώσεων', 'Τι συμβαίνει στη γειτονιά τις επόμενες εβδομάδες.'],
    ['searchPlaceholder', 'Παράδειγμα αναζήτησης', 'π.χ. Επταπύργιο, καλντερίμια…'],
    ...Object.entries(categories).map(([key, value]) => [`category_${key}_description`, `Περιγραφή: ${value.name}`, value.description]),
  ] },
] as const;

export const defaultSettings: Record<string, string> = Object.fromEntries(settingsGroups.flatMap(group => group.fields.map(field => [field[0], field[2]])));

// Missing fields inherit defaults; intentionally cleared optional fields stay empty.
export function resolveSettings(saved: Record<string, string> = {}) {
  const result = { ...defaultSettings, ...saved };
  result['companyName'] = saved['companyName']?.trim() || defaultSettings['companyName'] || 'Επιτροπή Άνω Πόλης';
  return result;
}

export function safeSocialUrl(value?: string) {
  try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

export function isLinkableSetting(key: string) {
  return !['homeTitle', 'siteDescription', 'aboutImageAlt', 'searchPlaceholder', 'facebook', 'instagram'].includes(key);
}

type ContentMatch = { loaderData?: unknown };
export function settingsFromMatches(matches: readonly ContentMatch[]) {
  for (const match of matches) {
    const data = match.loaderData;
    if (data && typeof data === 'object' && 'settings' in data) {
      return resolveSettings(data.settings as Record<string, string>);
    }
  }
  return resolveSettings();
}

export function companyHead(matches: readonly ContentMatch[], title?: string, description?: string) {
  const settings = settingsFromMatches(matches);
  const fullTitle = `${title} — ${settings['companyName']}`;
  const text = description ?? settings['siteDescription'];
  return { meta: [
    { title: fullTitle }, { name: 'description', content: text },
    { property: 'og:title', content: fullTitle }, { property: 'og:description', content: text },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] };
}