import { createClient } from '@supabase/supabase-js';
import type { TableName, Tables } from './types';
import { buildSeed } from './seed';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
/** Sin credenciales Supabase la app corre en modo demo con datos locales (localStorage). */
export const isDemo = !supabase;

export const uid = () => crypto.randomUUID();

const LS = 'gmm-demo-v1';
type Store = { [K in TableName]: Tables[K][] };

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw);
  } catch { /* storage no disponible */ }
  const s = buildSeed();
  const st: Store = { ...s, failures: [], feedback: [], plans: [], work_orders: [], cost_docs: [] };
  saveStore(st);
  return st;
}
function saveStore(st: Store) {
  try { localStorage.setItem(LS, JSON.stringify(st)); } catch { /* ignorar */ }
}

export async function list<T extends TableName>(t: T): Promise<Tables[T][]> {
  if (supabase) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) throw error;
    return data as Tables[T][];
  }
  return loadStore()[t] as Tables[T][];
}
export async function insert<T extends TableName>(t: T, row: Tables[T]): Promise<Tables[T]> {
  if (supabase) {
    const { data, error } = await supabase.from(t).insert(row).select().single();
    if (error) throw error;
    return data as Tables[T];
  }
  const st = loadStore();
  (st[t] as Tables[T][]).push(row);
  saveStore(st);
  return row;
}
export async function update<T extends TableName>(t: T, id: string, patch: Partial<Tables[T]>): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from(t).update(patch as never).eq('id', id);
    if (error) throw error;
    return;
  }
  const st = loadStore();
  const arr = st[t] as { id: string }[];
  const i = arr.findIndex((r) => r.id === id);
  if (i >= 0) arr[i] = { ...arr[i], ...patch };
  saveStore(st);
}
export async function remove(t: TableName, id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from(t).delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const st = loadStore();
  (st[t] as { id: string }[]) = (st[t] as { id: string }[]).filter((r) => r.id !== id);
  saveStore(st);
}
