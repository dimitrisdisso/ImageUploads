import { SettingsText } from "@/components/settings-text";
import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { useSiteSettings } from "@/lib/cms";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/apostoli")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, settings['contactTitle'], settings['contactIntro']); return result; },
  component: Tip,
});

function Tip() {
  const settings = useSiteSettings();
  const [sent, setSent] = useState(false);
  const [busy,setBusy]=useState(false);
  const [hasPhotos,setHasPhotos]=useState(false);
  const field = "w-full border border-input px-3 py-2 outline-none focus:border-primary";
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-4xl font-bold"><SettingsText name="contactTitle"/></h1>
      <p className="mt-3 text-lg text-muted-foreground"><SettingsText name="contactIntro"/></p>
      {sent ? (
        <div className="mt-8 border-l-4 border-primary bg-accent p-6">
          <p className="font-serif text-xl font-bold">Ευχαριστούμε!</p>
          <p className="mt-1">Λάβαμε το μήνυμά σας. Αν χρειαστούμε περισσότερες πληροφορίες, θα επικοινωνήσουμε μαζί σας.</p>
        </div>
      ) : (
        <form onSubmit={async (e) => { e.preventDefault(); const form=new FormData(e.currentTarget);setBusy(true);const files=form.getAll("photos").filter((f):f is File=>f instanceof File && f.size>0);if(files.some(f=>f.size>1000000)||files.length>3){toast.error("Έως 3 φωτογραφίες, μικρότερες από 1 MB η καθεμία.");setBusy(false);return;}if(files.length&&!String(form.get("photoCredit")??"").trim()){toast.error("Συμπληρώστε την πηγή / δημιουργό των φωτογραφιών.");setBusy(false);return;}form.delete("photos");for(const f of files)form.append("photos",f);let ok=false;try{const res=await fetch("/api/public/tip",{method:"POST",body:form});ok=res.ok;}catch{ok=false;}setBusy(false);if(!ok)toast.error("Η αποστολή απέτυχε. Δοκιμάστε ξανά.");else setSent(true); }} className="mt-8 space-y-4">
          <label className="block"><span className="text-sm font-bold">Είδος</span>
            <select name="type" className={field}><option>Είδηση</option><option>Πρόβλημα στη γειτονιά</option><option>Ιδέα για ρεπορτάζ</option><option>Φωτογραφία</option></select>
          </label>
          <label className="block"><span className="text-sm font-bold">Θέμα *</span><input name="subject" required maxLength={150} className={field} /></label>
          <label className="block"><span className="text-sm font-bold">Περιγραφή *</span><textarea name="description" required rows={6} maxLength={4000} className={field} placeholder="Πού, πότε, τι συνέβη;" /></label>
          <label className="block"><span className="text-sm font-bold">Φωτογραφίες</span><input name="photos" onChange={e=>setHasPhotos(Boolean(e.target.files?.length))} type="file" accept="image/*" multiple className={field} /></label>
          {hasPhotos&&<label className="block"><span className="text-sm font-bold">Πηγή / δημιουργός φωτογραφιών *</span><input name="photoCredit" required maxLength={500} className={field}/></label>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-sm font-bold">Όνομα</span><input name="name" maxLength={80} className={field} /></label>
            <label className="block"><span className="text-sm font-bold">Email</span><input name="email" type="email" maxLength={255} className={field} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input name="anonymous" type="checkbox" /> Θέλω να παραμείνω ανώνυμος/η</label>
          <Button type="submit" disabled={busy}>{busy?"Αποστολή…":"Αποστολή"}</Button>
        </form>
      )}
    </main>
  );
}
