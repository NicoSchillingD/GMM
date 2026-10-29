import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isDemo, list, supabase, insert, uid } from './db';
import type { Profile, Tables, TableName } from './types';

type Data = { [K in TableName]: Tables[K][] };
const empty: Data = { profiles: [], areas: [], assets: [], assignments: [], failures: [], feedback: [], plans: [], work_orders: [], cost_docs: [] };
const NAMES = Object.keys(empty) as TableName[];

interface Ctx {
  data: Data; me: Profile | null; loading: boolean; reload: () => Promise<void>;
  signIn: (profileId?: string) => Promise<void>; signOut: () => Promise<void>;
  can: (...roles: Profile['rol'][]) => boolean;
}
const C = createContext<Ctx>(null!);
export const useApp = () => useContext(C);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(empty);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await Promise.all(NAMES.map((n) => list(n)));
    setData(Object.fromEntries(NAMES.map((n, i) => [n, res[i]])) as Data);
  }, []);

  const resolveSupabaseUser = useCallback(async () => {
    if (!supabase) return;
    const { data: s } = await supabase.auth.getSession();
    const email = s.session?.user.email;
    if (!email) return setMe(null);
    await supabase.rpc('claim_profile'); // enlaza el perfil precargado con este usuario M365
    const profiles = await list('profiles');
    let p = profiles.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!p) {
      // Primer ingreso: rol mínimo; un admin lo eleva desde Usuarios.
      p = await insert('profiles', { id: s.session!.user.id, nombre: s.session!.user.user_metadata?.full_name ?? email, email, rol: 'consulta' });
    }
    setMe(p);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (isDemo) {
          const id = localStorage.getItem('gmm-demo-user');
          await reload();
          if (id) setMe((await list('profiles')).find((p) => p.id === id) ?? null);
        } else {
          await resolveSupabaseUser();
          await reload();
          supabase!.auth.onAuthStateChange(() => { void resolveSupabaseUser().then(reload); });
        }
      } finally { setLoading(false); }
    })();
  }, [reload, resolveSupabaseUser]);

  const signIn = async (profileId?: string) => {
    if (isDemo) {
      localStorage.setItem('gmm-demo-user', profileId!);
      setMe(data.profiles.find((p) => p.id === profileId) ?? null);
    } else {
      await supabase!.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email profile', redirectTo: location.origin } });
    }
  };
  const signOut = async () => {
    if (isDemo) localStorage.removeItem('gmm-demo-user'); else await supabase!.auth.signOut();
    setMe(null);
  };
  const can = (...roles: Profile['rol'][]) => !!me && (me.rol === 'admin' || roles.includes(me.rol));

  return <C.Provider value={{ data, me, loading, reload, signIn, signOut, can }}>{children}</C.Provider>;
}
export { uid };
