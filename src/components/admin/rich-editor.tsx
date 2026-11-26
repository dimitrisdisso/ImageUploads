import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Youtube from '@tiptap/extension-youtube';
import { Placeholder } from '@tiptap/extensions';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  IndentIncrease, IndentDecrease, Quote, Minus, Link2, Unlink, ImagePlus, Video, Undo2, Redo2, Highlighter,
  Baseline, RemoveFormatting, MessageSquareQuote, Loader2, Film,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArticleImage, ArticleMedia, PullQuote, type ImageAlign, type QuoteVariant } from './editor-nodes';
import { MediaPickerDialog } from './media-library';
import { MediaEmbedDialog } from './media-embed-dialog';
import { composeCaption } from '@/lib/media-embed';
import { replaceStorageRefs, storagePaths, toStorageRefs } from '@/lib/article-html';
import { signPaths } from '@/lib/media';

type Post = { id: string; status: string; data: Record<string, unknown> };

const FONTS = [
  ['', 'Προεπιλογή'],
  ['Literata, Georgia, serif', 'Literata (serif)'],
  ['Manrope, system-ui, sans-serif', 'Manrope (sans)'],
  ['Georgia, serif', 'Georgia'],
  ['"Courier New", monospace', 'Courier'],
] as const;
const SIZES = ['', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px'];
const COLORS = ['#7b1d26', '#1f1a17', '#5a5048', '#1f4e79', '#2e6b3f', '#b5651d'];
const HIGHLIGHTS = ['#f1e8e1', '#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe'];

function Tool({ label, shortcut, active, disabled, onClick, children }: { label: string; shortcut?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded px-2 text-sm transition-colors disabled:opacity-40 ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}
const Sep = () => <span aria-hidden className="mx-1 h-6 w-px bg-border" />;

export function RichEditor({ value, onChange, posts }: { value: string; onChange: (html: string) => void; posts: Post[] }) {
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const [picker, setPicker] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] }, link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder: 'Ξεκινήστε να γράφετε το άρθρο…' }),
      ArticleImage,
      ArticleMedia,
      PullQuote,
    ],
    content: '',
    editorProps: { attributes: { class: 'prose-article article-body article-editor', 'aria-label': 'Κείμενο άρθρου', spellcheck: 'true', lang: 'el' } },
    onUpdate: ({ editor }) => { if (loaded.current) onChange(toStorageRefs(editor.getHTML())); },
  });

  useEffect(() => {
    if (!editor || loaded.current) return;
    let cancelled = false;
    void signPaths(storagePaths(value)).then((urls) => {
      if (cancelled) return;
      editor.commands.setContent(replaceStorageRefs(value, urls), { emitUpdate: false });
      loaded.current = true;
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [editor, value]);

  if (!editor) return <div className="cms-input min-h-64" />;

  const block = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : editor.isActive('heading', { level: 5 }) ? 'h5' : editor.isActive('heading', { level: 6 }) ? 'h6' : 'p';
  const ts = editor.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const c = () => editor.chain().focus();
  const inList = editor.isActive('bulletList') || editor.isActive('orderedList');

  return (
    <div className="rich-editor border border-input bg-background">
      <div role="toolbar" aria-label="Μορφοποίηση κειμένου" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background p-1.5">
        <Tool label="Αναίρεση" shortcut="Ctrl+Z" disabled={!editor.can().undo()} onClick={() => c().undo().run()}><Undo2 className="size-4" /></Tool>
        <Tool label="Επανάληψη" shortcut="Ctrl+Shift+Z" disabled={!editor.can().redo()} onClick={() => c().redo().run()}><Redo2 className="size-4" /></Tool>
        <Sep />
        <select aria-label="Στυλ κειμένου" title="Στυλ κειμένου" className="h-9 rounded border bg-background px-1 text-sm" value={block} onChange={(e) => { const v = e.target.value; if (v === 'p') c().setParagraph().run(); else c().setHeading({ level: Number(v.slice(1)) as 1 }).run(); }}>
          <option value="p">Παράγραφος</option>
          {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={`h${l}`}>Επικεφαλίδα {l}</option>)}
        </select>
        <select aria-label="Γραμματοσειρά" title="Γραμματοσειρά" className="h-9 max-w-36 rounded border bg-background px-1 text-sm" value={ts.fontFamily ?? ''} onChange={(e) => (e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run())}>
          {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
        </select>
        <select aria-label="Μέγεθος γραμματοσειράς" title="Μέγεθος γραμματοσειράς" className="h-9 rounded border bg-background px-1 text-sm" value={ts.fontSize ?? ''} onChange={(e) => (e.target.value ? c().setFontSize(e.target.value).run() : c().unsetFontSize().run())}>
          {SIZES.map((s) => <option key={s} value={s}>{s ? s.replace('px', '') : 'Μέγεθος'}</option>)}
        </select>
        <Sep />
        <Tool label="Έντονα" shortcut="Ctrl+B" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="size-4" /></Tool>
        <Tool label="Πλάγια" shortcut="Ctrl+I" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="size-4" /></Tool>
        <Tool label="Υπογράμμιση" shortcut="Ctrl+U" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><Underline className="size-4" /></Tool>
        <Tool label="Διακριτή διαγραφή" shortcut="Ctrl+Shift+S" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><Strikethrough className="size-4" /></Tool>
        <ColorMenu label="Χρώμα κειμένου" icon={<Baseline className="size-4" />} colors={COLORS} current={ts.color} onPick={(col) => (col ? c().setColor(col).run() : c().unsetColor().run())} />
        <ColorMenu label="Επισήμανση" icon={<Highlighter className="size-4" />} colors={HIGHLIGHTS} current={editor.getAttributes('highlight')['color'] as string | undefined} onPick={(col) => (col ? c().setHighlight({ color: col }).run() : c().unsetHighlight().run())} />
        <Sep />
        <Tool label="Στοίχιση αριστερά" shortcut="Ctrl+Shift+L" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}><AlignLeft className="size-4" /></Tool>
        <Tool label="Στοίχιση στο κέντρο" shortcut="Ctrl+Shift+E" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}><AlignCenter className="size-4" /></Tool>
        <Tool label="Στοίχιση δεξιά" shortcut="Ctrl+Shift+R" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}><AlignRight className="size-4" /></Tool>
        <Tool label="Πλήρης στοίχιση" shortcut="Ctrl+Shift+J" active={editor.isActive({ textAlign: 'justify' })} onClick={() => c().setTextAlign('justify').run()}><AlignJustify className="size-4" /></Tool>
        <Sep />
        <Tool label="Λίστα με κουκκίδες" shortcut="Ctrl+Shift+8" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="size-4" /></Tool>
        <Tool label="Αριθμημένη λίστα" shortcut="Ctrl+Shift+7" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="size-4" /></Tool>
        <Tool label="Αύξηση εσοχής (λίστες)" shortcut="Tab" disabled={!inList || !editor.can().sinkListItem('listItem')} onClick={() => c().sinkListItem('listItem').run()}><IndentIncrease className="size-4" /></Tool>
        <Tool label="Μείωση εσοχής (λίστες)" shortcut="Shift+Tab" disabled={!inList || !editor.can().liftListItem('listItem')} onClick={() => c().liftListItem('listItem').run()}><IndentDecrease className="size-4" /></Tool>
        <Tool label="Απλή παράθεση" shortcut="Ctrl+Shift+B" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote className="size-4" /></Tool>
        <Tool label="Διαχωριστική γραμμή" onClick={() => c().setHorizontalRule().run()}><Minus className="size-4" /></Tool>
        <Sep />
        <Tool label="Σύνδεσμος" shortcut="Ctrl+K" active={editor.isActive('link')} onClick={() => setLinkOpen(true)}><Link2 className="size-4" /></Tool>
        <Tool label="Αφαίρεση συνδέσμου" disabled={!editor.isActive('link')} onClick={() => c().unsetLink().run()}><Unlink className="size-4" /></Tool>
        <Tool label="Εισαγωγή εικόνας" onClick={() => setPicker(true)}><ImagePlus className="size-4" /></Tool>
        <Tool label="Πολυμέσα από GitHub (εικόνα, βίντεο, ήχος)" onClick={() => setEmbedOpen(true)}><Film className="size-4" /></Tool>
        <Tool label="Ενσωμάτωση βίντεο YouTube" onClick={() => setVideoOpen(true)}><Video className="size-4" /></Tool>
        <button type="button" title="Πλαίσιο Παράθεσης" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuoteOpen(true)} className={`inline-flex h-9 items-center gap-1.5 rounded px-2 text-sm font-semibold ${editor.isActive('pullQuote') ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:opacity-90'}`}>
          <MessageSquareQuote className="size-4" />Πλαίσιο Παράθεσης
        </button>
        <Tool label="Καθαρισμός μορφοποίησης" onClick={() => c().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="size-4" /></Tool>
      </div>

      {editor.isActive('articleImage') && <ImageControls editor={editor} />}
      {editor.isActive('articleMedia') && <MediaControls editor={editor} />}
      {editor.isActive('pullQuote') && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted px-3 py-2 text-sm">
          <span className="font-semibold">Πλαίσιο Παράθεσης</span>
          <Button size="sm" variant="outline" type="button" onClick={() => setQuoteOpen(true)}>Επεξεργασία</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => c().deleteSelection().run()}>Αφαίρεση</Button>
        </div>
      )}

      <div className="relative">
        {!ready && <p role="status" className="absolute inset-x-0 top-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Φόρτωση κειμένου…</p>}
        <EditorContent editor={editor} className="max-h-[70vh] min-h-[420px] overflow-y-auto px-4 py-6 sm:px-8" />
      </div>
      <p className="border-t px-3 py-1.5 text-right text-xs text-muted-foreground">{editor.getText().trim().split(/\s+/).filter(Boolean).length} λέξεις</p>

      <MediaPickerDialog open={picker} onOpenChange={setPicker} posts={posts} onPick={(img) => c().insertArticleImage({ src: img.url, alt: img.alt, caption: img.credit }).run()} />
      <MediaEmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        onInsert={(m) => (m.kind === 'image'
          ? c().insertArticleImage({ src: m.src, alt: m.label, caption: composeCaption(m.caption, m.credit, 'image') }).run()
          : c().insertArticleMedia({ kind: m.kind, src: m.src, label: m.label, caption: m.caption, credit: m.credit, poster: m.poster, captions: m.captions }).run())}
      />
      <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} initial={(editor.getAttributes('link')['href'] as string) ?? ''} onSave={(href) => (href ? c().extendMarkRange('link').setLink({ href }).run() : c().extendMarkRange('link').unsetLink().run())} />
      <VideoDialog open={videoOpen} onOpenChange={setVideoOpen} onSave={(src) => c().setYoutubeVideo({ src }).run()} />
      <QuoteDialog
        open={quoteOpen}
        onOpenChange={setQuoteOpen}
        initial={editor.isActive('pullQuote') ? (editor.getAttributes('pullQuote') as QuoteAttrs) : undefined}
        onSave={(attrs) => (editor.isActive('pullQuote') ? c().updateAttributes('pullQuote', attrs).run() : c().insertPullQuote(attrs).run())}
      />
    </div>
  );
}

function ColorMenu({ label, icon, colors, current, onPick }: { label: string; icon: ReactNode; colors: string[]; current?: string | undefined; onPick: (c: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <Tool label={label} active={open} onClick={() => setOpen(!open)}>
        <span className="flex flex-col items-center">{icon}<span className="mt-0.5 h-1 w-4 rounded" style={{ background: current ?? 'transparent' }} /></span>
      </Tool>
      {open && (
        <span className="absolute left-0 top-10 z-20 flex gap-1 rounded border bg-background p-2 shadow-md">
          {colors.map((col) => (
            <button key={col} type="button" aria-label={`${label} ${col}`} title={col} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(col); setOpen(false); }} className="size-6 rounded border" style={{ background: col }} />
          ))}
          <button type="button" title="Χωρίς" aria-label={`${label}: κανένα`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(null); setOpen(false); }} className="size-6 rounded border text-xs">×</button>
        </span>
      )}
    </span>
  );
}

function ImageControls({ editor }: { editor: Editor }) {
  const attrs = editor.getAttributes('articleImage') as { alt: string; caption: string; align: ImageAlign; width: number };
  const set = (a: Partial<typeof attrs>) => editor.chain().updateAttributes('articleImage', a).run();
  const aligns: [ImageAlign, string][] = [['left', 'Αριστερά'], ['center', 'Κέντρο'], ['right', 'Δεξιά'], ['full', 'Πλήρες πλάτος']];
  return (
    <div className="grid gap-2 border-b bg-muted px-3 py-3 text-sm md:grid-cols-[auto_auto_1fr_1fr_auto] md:items-end">
      <div>
        <span className="mb-1 block text-xs font-semibold">Θέση</span>
        <div className="flex flex-wrap gap-1">{aligns.map(([v, l]) => <Button key={v} type="button" size="sm" variant={attrs.align === v ? 'default' : 'outline'} onClick={() => set({ align: v, width: v === 'full' ? 100 : v === 'center' ? attrs.width : Math.min(attrs.width, 50) })}>{l}</Button>)}</div>
      </div>
      <label className="text-xs font-semibold">Πλάτος
        <select className="cms-input mt-1 py-1.5" value={attrs.width} disabled={attrs.align === 'full'} onChange={(e) => set({ width: Number(e.target.value) })}>
          {[33, 50, 75, 100].map((w) => <option key={w} value={w}>{w}%</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">Λεζάντα<input className="cms-input mt-1 py-1.5" maxLength={300} value={attrs.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Προαιρετική λεζάντα" /></label>
      <label className="text-xs font-semibold">Εναλλακτικό κείμενο<input className="cms-input mt-1 py-1.5" maxLength={300} value={attrs.alt ?? ''} onChange={(e) => set({ alt: e.target.value })} placeholder="Περιγραφή για προσβασιμότητα" /></label>
      <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteSelection().run()}>Αφαίρεση</Button>
    </div>
  );
}

function MediaControls({ editor }: { editor: Editor }) {
  const attrs = editor.getAttributes('articleMedia') as { kind: string; label: string; caption: string; credit: string };
  const set = (a: Partial<typeof attrs>) => editor.chain().updateAttributes('articleMedia', a).run();
  return (
    <div className="grid gap-2 border-b bg-muted px-3 py-3 text-sm md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
      <label className="text-xs font-semibold">Τίτλος<input className="cms-input mt-1 py-1.5" maxLength={300} value={attrs.label ?? ''} onChange={(e) => set({ label: e.target.value })} /></label>
      <label className="text-xs font-semibold">Λεζάντα<input className="cms-input mt-1 py-1.5" maxLength={300} value={attrs.caption ?? ''} onChange={(e) => set({ caption: e.target.value })} /></label>
      <label className="text-xs font-semibold">Πηγή / δημιουργός<input className="cms-input mt-1 py-1.5" maxLength={200} value={attrs.credit ?? ''} onChange={(e) => set({ credit: e.target.value })} /></label>
      <Button type="button" size="sm" variant="ghost" onClick={() => editor.chain().focus().deleteSelection().run()}>Αφαίρεση</Button>
    </div>
  );
}

function LinkDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial: string; onSave: (href: string) => void }) {
  const [href, setHref] = useState(initial);
  useEffect(() => { if (open) setHref(initial); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Σύνδεσμος</DialogTitle><DialogDescription>Επιλέξτε πρώτα το κείμενο που θα γίνει σύνδεσμος.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); const v = href.trim(); if (v && !/^(https?:|mailto:|\/)/i.test(v)) onSave(`https://${v}`); else onSave(v); onOpenChange(false); }} className="space-y-4">
          <input autoFocus className="cms-input" placeholder="https://…" value={href} onChange={(e) => setHref(e.target.value)} aria-label="Διεύθυνση συνδέσμου" />
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ακύρωση</Button><Button type="submit">Αποθήκευση</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VideoDialog({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (src: string) => void }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); setError(''); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ενσωμάτωση βίντεο</DialogTitle><DialogDescription>Επικολλήστε σύνδεσμο από το YouTube.</DialogDescription></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); if (!/(youtube\.com|youtu\.be)\//i.test(src)) { setError('Υποστηρίζονται σύνδεσμοι YouTube.'); return; } onSave(src.trim()); setSrc(''); onOpenChange(false); }} className="space-y-4">
          <input autoFocus className="cms-input" placeholder="https://www.youtube.com/watch?v=…" value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Σύνδεσμος βίντεο" />
          {error && <p role="alert" className="text-sm text-primary">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ακύρωση</Button><Button type="submit">Εισαγωγή</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type QuoteAttrs = { text: string; name: string; role: string; source: string; variant: QuoteVariant };
function QuoteDialog({ open, onOpenChange, initial, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: QuoteAttrs | undefined; onSave: (a: QuoteAttrs) => void }) {
  const empty: QuoteAttrs = { text: '', name: '', role: '', source: '', variant: 'pull' };
  const [a, setA] = useState<QuoteAttrs>(empty);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setA(initial ? { ...empty, ...initial } : empty); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const field = (k: keyof QuoteAttrs, label: string, placeholder = '') => (
    <label className="block text-sm font-semibold">{label}<input className="cms-input mt-1" maxLength={200} value={a[k]} placeholder={placeholder} onChange={(e) => setA({ ...a, [k]: e.target.value })} /></label>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Πλαίσιο Παράθεσης</DialogTitle><DialogDescription>Αναδείξτε μια σημαντική δήλωση από συνέντευξη, κάτοικο ή ειδικό.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); const text = a.text.trim(); if (!text) { setError('Γράψτε την παράθεση.'); return; } onSave({ ...a, text: text.replace(/^[«"“]+|[»"”]+$/g, '') }); onOpenChange(false); }}>
          <label className="block text-sm font-semibold">Παράθεση<textarea autoFocus className="cms-input mt-1 font-serif text-lg" rows={4} maxLength={600} value={a.text} onChange={(e) => setA({ ...a, text: e.target.value })} /></label>
          <div className="grid gap-4 sm:grid-cols-2">{field('name', 'Όνομα προσώπου', 'π.χ. Σοφία Παπαδάκη')}{field('role', 'Ιδιότητα (προαιρετικό)', 'π.χ. κάτοικος Ακροπόλεως')}</div>
          {field('source', 'Πηγή (προαιρετικό)', 'π.χ. Συνέντευξη στην Επιτροπή, Οκτ. 2026')}
          <fieldset>
            <legend className="text-sm font-semibold">Στυλ</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([['pull', 'Κομψή παράθεση', 'Μέσα στο κείμενο, με διακριτικό πλαίσιο'], ['wide', 'Πλήρους πλάτους', 'Έντονη ανάδειξη ανάμεσα σε παραγράφους']] as const).map(([v, l, d]) => (
                <label key={v} className={`cursor-pointer border p-3 text-sm ${a.variant === v ? 'border-primary bg-accent' : ''}`}>
                  <input type="radio" name="variant" className="sr-only" checked={a.variant === v} onChange={() => setA({ ...a, variant: v })} />
                  <span className="block font-semibold">{l}</span><span className="text-muted-foreground">{d}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-primary">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Ακύρωση</Button><Button type="submit">{initial ? 'Ενημέρωση' : 'Εισαγωγή'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
