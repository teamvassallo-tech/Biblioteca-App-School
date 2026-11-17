import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const hasValidUrl =
  rawUrl.length > 0 &&
  !rawUrl.includes('YOUR_SUPABASE_URL') &&
  (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'));

const hasValidKey =
  rawAnonKey.length > 0 &&
  !rawAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

export const isSupabaseConfigured: boolean = hasValidUrl && hasValidKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: false,
      },
    })
  : null;

export function getSupabaseConfigError(): string {
  if (!hasValidUrl && !hasValidKey) {
    return 'Configurazione Supabase mancante: imposta le variabili d’ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
  }
  if (!hasValidUrl) {
    return 'URL Supabase non valido o mancante (VITE_SUPABASE_URL). Verifica le variabili d’ambiente del progetto.';
  }
  if (!hasValidKey) {
    return 'Chiave Anon Key Supabase mancante o non valida (VITE_SUPABASE_ANON_KEY). Verifica le variabili d’ambiente del progetto.';
  }
  return '';
}

export function formatSupabaseError(error: unknown, operation = 'connessione al database'): string {
  if (!isSupabaseConfigured || !supabase) {
    return getSupabaseConfigError();
  }

  const errObj = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  const rawMessage = errObj?.message || (typeof error === 'string' ? error : '');
  const code = errObj?.code || '';

  if (
    rawMessage.toLowerCase().includes('failed to fetch') ||
    rawMessage.toLowerCase().includes('network') ||
    rawMessage.toLowerCase().includes('load failed') ||
    rawMessage.toLowerCase().includes('fetch')
  ) {
    return `Database Supabase non raggiungibile durante l’operazione di ${operation}. Verifica la connessione Internet e l’URL VITE_SUPABASE_URL.`;
  }

  if (code === '42P01' || rawMessage.includes('relation "public.books" does not exist') || rawMessage.includes("Could not find the table 'public.books'")) {
    return 'La tabella "books" non esiste ancora nel database Supabase. Esegui lo schema SQL (supabase/schema.sql) nel tuo progetto Supabase.';
  }

  if (code === '42501' || rawMessage.toLowerCase().includes('row-level security')) {
    return 'Accesso negato dalle policy RLS di Supabase sulla tabella "books". Verifica le policy Row Level Security su Supabase.';
  }

  if (rawMessage) {
    return `Errore database Supabase (${operation}): ${rawMessage}`;
  }

  return `Impossibile completare l’operazione (${operation}) su Supabase. Riprova tra qualche istante.`;
}
