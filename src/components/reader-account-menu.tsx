import { Link, useRouterState } from '@tanstack/react-router';
import { UserRound, Bookmark, Heart, LogOut, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useReaderAuth } from '@/lib/reader-auth';

export function ReaderAccountMenu() {
  const { user, loading, logout } = useReaderAuth();
  const path = useRouterState({ select: s => s.location.href });
  if (loading) return <span className="block h-9 w-9 animate-pulse rounded bg-ink-foreground/10" aria-label="Φόρτωση λογαριασμού" />;
  if (!user) return <div className="flex items-center gap-1"><Button asChild variant="ghost" size="sm"><Link to="/auth" search={{ mode: 'login', redirect: path }}><UserRound className="size-4"/><span>Σύνδεση</span></Link></Button><Button asChild variant="secondary" size="sm" className="shrink-0"><Link to="/auth" search={{ mode: 'register', redirect: path }}><UserPlus className="size-4"/>Sign Up</Link></Button></div>;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Ο λογαριασμός μου" title="Ο λογαριασμός μου"><UserRound/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>Ο λογαριασμός μου</DropdownMenuLabel><DropdownMenuItem asChild><Link to="/profile" search={{ tab: 'saved' }}><UserRound/>Το προφίλ μου</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/profile" search={{ tab: 'saved' }}><Bookmark/>Αποθηκευμένα άρθρα</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/profile" search={{ tab: 'liked' }}><Heart/>Άρθρα που μου αρέσουν</Link></DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onSelect={() => { void logout(); }}><LogOut/>Αποσύνδεση</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}