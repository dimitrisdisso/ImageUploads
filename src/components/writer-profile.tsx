import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import type { Author } from '@/lib/content';

export function WriterProfile({ author }: { author: Author | undefined }) {
  const [open, setOpen] = useState(false);
  if (!author) return <span>Συντακτική ομάδα</span>;
  return <><Button type="button" variant="link" className="h-auto max-w-full whitespace-normal p-0 text-left text-inherit" onClick={() => setOpen(true)}>{author.name}</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{author.name}</DialogTitle></DialogHeader>{author.image && <img src={author.image} alt={author.name} className="mx-auto size-32 rounded-full object-cover"/>}{author.role && <p className="font-semibold text-primary">{author.role}</p>}{author.bio && <p className="whitespace-pre-line leading-relaxed">{author.bio}</p>}</DialogContent></Dialog></>;
}