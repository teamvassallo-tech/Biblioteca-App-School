-- Schema SQL per la tabella "books" su Supabase (PostgreSQL)
-- Eseguire questo script nell'SQL Editor del proprio progetto Supabase.

CREATE TABLE IF NOT EXISTS public.books (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'ic-erasmo',
  inventory_code TEXT NOT NULL,
  isbn TEXT,
  title TEXT NOT NULL,
  authors TEXT[] NOT NULL DEFAULT '{}',
  publisher TEXT,
  publication_year TEXT,
  genre TEXT NOT NULL DEFAULT 'Narrativa',
  age_group TEXT NOT NULL DEFAULT 'Primaria (8-11 anni - 3ª/5ª)',
  collocazione TEXT NOT NULL DEFAULT 'Scaffale Biblioteca',
  cover_url TEXT,
  synopsis TEXT,
  copies_total INTEGER NOT NULL DEFAULT 1,
  copies_available INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'Disponibile',
  page_count INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_school_id ON public.books (school_id);
CREATE INDEX IF NOT EXISTS idx_books_inventory_code ON public.books (inventory_code);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON public.books (isbn);

-- Abilita Row Level Security (RLS) e policy per accesso applicativo via Anon Key
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to books" ON public.books;
CREATE POLICY "Allow all access to books"
  ON public.books
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
