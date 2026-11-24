import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isDemo, list, supabase, uid } from './db';
import { detachPush } from './push';
import type { Profile, Tables, TableName } from './types';

type Data = { [K in TableName]: Tables[K][] };
const empty: Data = { profiles: [], areas: [], assets: [], assignments: [], failures: [], feedback: [], plans: [], work_orders: [], cost_docs: [] };
const NAMES = Object.keys(empty) as TableName[];

interface Ctx {
  data: Data; me: Profile | null; loading: boolean; reload: () => Promise<void>;
  signIn: (idOrEmail: string, password?: string) => Promise<string | null>; resetPassword: (email: string) => Promise<string | null>; signOut: () => Promise<void>;
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
    const p = profiles.find((x) => x.email.toLowerCase() === email.toLowerCase());
    // Sin auto-registro: si el correo no tiene perfil, no hay acceso.
    if (!p) { await supabase.auth.signOut(); return setMe(null); }
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

  const signIn = async (idOrEmail: string, password?: string): Promise<string | null> => {
    if (isDemo) {
      localStorage.setItem('gmm-demo-user', idOrEmail);
      setMe(data.profiles.find((p) => p.id === idOrEmail) ?? null);
      return null;
    }
    const { error } = await supabase!.auth.signInWithPassword({ email: idOrEmail.trim(), password: password ?? '' });
    if (error) return 'Correo o contraseña incorrectos.';
    await resolveSupabaseUser();
    await reload();
    return null;
  };
  const resetPassword = async (email: string): Promise<string | null> => {
    if (isDemo) return null;
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin });
    return error ? 'No se pudo enviar el correo.' : null;
  };
  const signOut = async () => {
    if (!isDemo) await detachPush(); // este dispositivo deja de recibir los avisos de esta cuenta
    if (isDemo) localStorage.removeItem('gmm-demo-user'); else await supabase!.auth.signOut();
    setMe(null);
  };
  const can = (...roles: Profile['rol'][]) => !!me && (me.rol === 'admin' || roles.includes(me.rol));

  return <C.Provider value={{ data, me, loading, reload, signIn, resetPassword, signOut, can }}>{children}</C.Provider>;
}
export { uid };
