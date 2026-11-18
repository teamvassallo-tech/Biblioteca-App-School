-- ============================================================================
-- BiblioScuola - Schema SQL Completo per Supabase (PostgreSQL)
-- Da eseguire nel "SQL Editor" del proprio progetto Supabase.
-- Crea le tabelle: books (libri), students (alunni), loans (prestiti)
-- con indici, permessi e policy Row Level Security (RLS) per anon/authenticated.
-- ============================================================================

-- Permessi base sullo schema public per le chiavi anon / publishable e authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Funzione trigger riutilizzabile per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. TABELLA LIBRI (public.books)
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_books_title ON public.books (title);

DROP TRIGGER IF EXISTS trg_books_updated_at ON public.books;
CREATE TRIGGER trg_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated full access on books" ON public.books;
DROP POLICY IF EXISTS "Allow all access to books" ON public.books;
CREATE POLICY "Allow anon and authenticated full access on books"
  ON public.books
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.books TO anon, authenticated;

-- ============================================================================
-- 2. TABELLA ALUNNI (public.students)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.students (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'ic-erasmo',
  student_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  school_level TEXT NOT NULL DEFAULT 'Primaria',
  class_section TEXT NOT NULL DEFAULT '1A',
  phone_parent TEXT,
  email_parent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students (school_id);
CREATE INDEX IF NOT EXISTS idx_students_code ON public.students (student_code);
CREATE INDEX IF NOT EXISTS idx_students_class_section ON public.students (class_section);

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated full access on students" ON public.students;
CREATE POLICY "Allow anon and authenticated full access on students"
  ON public.students
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.students TO anon, authenticated;

-- ============================================================================
-- 3. TABELLA PRESTITI (public.loans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL DEFAULT 'ic-erasmo',
  book_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  book_inventory_code TEXT NOT NULL,
  book_cover_url TEXT,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  student_code TEXT NOT NULL,
  loan_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  return_date TEXT,
  status TEXT NOT NULL DEFAULT 'Attivo',
  renewals_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_school_id ON public.loans (school_id);
CREATE INDEX IF NOT EXISTS idx_loans_book_id ON public.loans (book_id);
CREATE INDEX IF NOT EXISTS idx_loans_student_id ON public.loans (student_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans (status);

DROP TRIGGER IF EXISTS trg_loans_updated_at ON public.loans;
CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon and authenticated full access on loans" ON public.loans;
CREATE POLICY "Allow anon and authenticated full access on loans"
  ON public.loans
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loans TO anon, authenticated;
