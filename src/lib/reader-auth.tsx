import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { getCurrentUser, signOut, type CurrentUser } from '@/lib/auth.functions';

const ReaderAuthContext = createContext<{ user: CurrentUser | null; loading: boolean; logout: () => Promise<void>; refresh: () => Promise<void> }>({ user: null, loading: true, logout: async () => {}, refresh: async () => {} });
export function ReaderAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const query = useQuery({ queryKey: ['reader-user'], queryFn: () => getCurrentUser(), retry: false });
  /** Call after signing in or out so every query reflects the new account. */
  const refresh = async () => {
    await qc.invalidateQueries();
    await router.invalidate();
  };
  const logout = async () => {
    await qc.cancelQueries();
    try { await signOut(); } catch { toast.error('Η αποσύνδεση απέτυχε. Δοκιμάστε ξανά.'); return; }
    qc.clear();
    qc.setQueryData(['reader-user'], null);
    await navigate({ to: '/auth', search: { mode: 'login', redirect: '/profile' }, replace: true });
  };
  return <ReaderAuthContext.Provider value={{ user: query.data ?? null, loading: query.isPending, logout, refresh }}>{children}</ReaderAuthContext.Provider>;
}
export const useReaderAuth = () => useContext(ReaderAuthContext);
