import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, GENRE_OPTIONS, AGE_GROUP_OPTIONS } from '../../types';
import { AddBookModal } from './AddBookModal';
import { BookDetailModal } from './BookDetailModal';
import { PrintBarcodesModal } from './PrintBarcodesModal';
import { BookCoverImage } from './BookCoverImage';
import { classifyBook } from '../../utils/bookClassifier';
import {
  Search,
  Plus,
  Printer,
  Grid,
  List,
  Library,
  BookOpen,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Filter,
  Layers,
  ArrowLeftRight,
  BookMarked,
  GraduationCap,
  Tag,
  X,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

interface CatalogViewProps {
  onLoanBook?: (book: Book) => void;
  onOpenAddModal?: () => void;
  isAddModalOpen?: boolean;
  onCloseAddModal?: () => void;
}

type SortOption = 'title-asc' | 'title-desc' | 'recent' | 'year-desc' | 'author-asc';

// Helper to determine color badge and clean label for age groups
function getAgeGroupBadge(ageGroup?: string) {
  if (!ageGroup) return { label: 'Età n/d', short: 'n/d', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  const str = ageGroup.toLowerCase();
  if (str.includes('6-8')) {
    return { label: 'Primaria (6-8 anni)', short: '6-8 anni', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (str.includes('8-11')) {
    return { label: 'Primaria (8-11 anni)', short: '8-11 anni', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  }
  if (str.includes('11-14')) {
    return { label: 'Secondaria (11-14 anni)', short: '11-14 anni', color: 'bg-sky-100 text-sky-800 border-sky-300' };
  }
  if (str.includes('14+') || str.includes('adulti')) {
    return { label: 'Giovani Adulti (14+)', short: '14+ anni', color: 'bg-purple-100 text-purple-800 border-purple-300' };
  }
  if (str.includes('docenti') || str.includes('guide')) {
    return { label: 'Docenti & Guide', short: 'Docenti', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
  }
  return { label: ageGroup, short: ageGroup, color: 'bg-slate-100 text-slate-700 border-slate-300' };
}

// Smart matching for age group filter
function matchAgeFilter(bookAge: string | undefined, selectedAge: string): boolean {
  if (selectedAge === 'Tutti') return true;
  if (!bookAge) return false;
  const b = bookAge.trim().toLowerCase();
  const f = selectedAge.trim().toLowerCase();
  if (b === f) return true;

  // Substring checks for standard brackets
  if (f.includes('6-8') && b.includes('6-8')) return true;
  if (f.includes('8-11') && b.includes('8-11')) return true;
  if (f.includes('11-14') && b.includes('11-14')) return true;
  if (f.includes('14+') && (b.includes('14+') || b.includes('giovani'))) return true;
  if (f.includes('docenti') && (b.includes('docenti') || b.includes('guide'))) return true;

  return b.includes(f) || f.includes(b);
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  onLoanBook,
  onOpenAddModal: externalOnOpenAdd,
  isAddModalOpen: externalIsAddOpen,
  onCloseAddModal: externalOnCloseAdd,
}) => {
  const { books, triggerScanFeedback, batchUpdateBooks } = useLibrary();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('Tutti');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('Tutti');
  const [selectedAvailability, setSelectedAvailability] = useState<'all' | 'available' | 'loaned'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isReclassifying, setIsReclassifying] = useState(false);

  // Modals
  const [internalIsAddOpen, setInternalIsAddOpen] = useState(false);
  const [selectedBookForDetail, setSelectedBookForDetail] = useState<Book | null>(null);
  const [isPrintBarcodesOpen, setIsPrintBarcodesOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Automatic Re-classification for catalog books (e.g. books that were initially saved as 'Narrativa')
  const handleAutoFixCatalogGenres = () => {
    if (books.length === 0) {
      triggerScanFeedback('info', 'Il catalogo è vuoto.');
      return;
    }

    setIsReclassifying(true);
    let updatedCount = 0;
    const updates: Array<{ id: string; changes: Partial<Book> }> = [];

    for (const b of books) {
      const suggested = classifyBook(b.title, b.authors, b.synopsis || '', [], '');
      const shouldUpdateGenre = (b.genre === 'Narrativa' && suggested.genre !== 'Narrativa');
      const shouldUpdateAge = (!b.ageGroup || (b.ageGroup === 'Primaria (8-11 anni - 3ª/5ª)' && suggested.ageGroup !== b.ageGroup));

      if (shouldUpdateGenre || shouldUpdateAge) {
        updates.push({
          id: b.id,
          changes: {
            genre: shouldUpdateGenre ? suggested.genre : b.genre,
            ageGroup: shouldUpdateAge ? suggested.ageGroup : b.ageGroup,
          },
        });
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      batchUpdateBooks(updates);
      triggerScanFeedback('success', `Rianalisi completata: aggiornati ${updatedCount} volumi con generi ed età appropriati!`);
    } else {
      triggerScanFeedback('info', 'Tutti i libri presenti hanno già un genere e fascia d\'età coerenti.');
    }
    setIsReclassifying(false);
  };

  const handleOpenAddModal = () => {
    if (externalOnOpenAdd) {
      externalOnOpenAdd();
    } else {
      setInternalIsAddOpen(true);
    }
  };

  const isAddModalOpen = Boolean(externalIsAddOpen || internalIsAddOpen);
  const handleCloseAddModal = () => {
    setInternalIsAddOpen(false);
    if (externalOnCloseAdd) {
      externalOnCloseAdd();
    }
  };

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Compute all available genres combining predefined standards and actual book data
  const availableGenres = useMemo(() => {
    const fromBooks = books.map((b) => b.genre).filter(Boolean);
    const set = new Set<string>([...GENRE_OPTIONS, ...fromBooks]);
    return ['Tutti', ...Array.from(set)];
  }, [books]);

  // Compute all available age groups combining predefined standards and actual book data
  const availableAgeGroups = useMemo(() => {
    const fromBooks = books.map((b) => b.ageGroup).filter(Boolean);
    const set = new Set<string>([...AGE_GROUP_OPTIONS, ...fromBooks]);
    return ['Tutti', ...Array.from(set)];
  }, [books]);

  // Book counts per genre
  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = { Tutti: books.length };
    for (const g of availableGenres) {
      if (g === 'Tutti') continue;
      counts[g] = books.filter((b) => b.genre && b.genre.toLowerCase() === g.toLowerCase()).length;
    }
    return counts;
  }, [books, availableGenres]);

  // Book counts per age group
  const ageCounts = useMemo(() => {
    const counts: Record<string, number> = { Tutti: books.length };
    for (const a of availableAgeGroups) {
      if (a === 'Tutti') continue;
      counts[a] = books.filter((b) => matchAgeFilter(b.ageGroup, a)).length;
    }
    return counts;
  }, [books, availableAgeGroups]);

  // Filter and sort books
  const filteredBooks = useMemo(() => {
    const list = books.filter((book) => {
      // 1. Availability filter
      if (selectedAvailability === 'available' && book.copiesAvailable <= 0) return false;
      if (selectedAvailability === 'loaned' && book.copiesAvailable > 0) return false;

      // 2. Genre filter
      if (selectedGenre !== 'Tutti') {
        const bookG = (book.genre || '').trim().toLowerCase();
        const selG = selectedGenre.trim().toLowerCase();
        if (bookG !== selG) return false;
      }

      // 3. Age Group filter
      if (selectedAgeGroup !== 'Tutti') {
        if (!matchAgeFilter(book.ageGroup, selectedAgeGroup)) return false;
      }

      // 4. Free text & barcode search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = book.title.toLowerCase().includes(q);
        const inAuthors = (book.authors || []).some((a) => a.toLowerCase().includes(q));
        const inCode = (book.inventoryCode || '').toLowerCase().includes(q);
        const inIsbn = (book.isbn || '').toLowerCase().includes(q);
        const inCollocazione = (book.collocazione || '').toLowerCase().includes(q);
        const inGenre = (book.genre || '').toLowerCase().includes(q);
        const inAge = (book.ageGroup || '').toLowerCase().includes(q);
        return inTitle || inAuthors || inCode || inIsbn || inCollocazione || inGenre || inAge;
      }

      return true;
    });

    // Sort list
    return list.sort((a, b) => {
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title, 'it', { sensitivity: 'base' });
      if (sortBy === 'title-desc') return b.title.localeCompare(a.title, 'it', { sensitivity: 'base' });
      if (sortBy === 'author-asc') {
        const authorA = a.authors?.[0] || '';
        const authorB = b.authors?.[0] || '';
        return authorA.localeCompare(authorB, 'it', { sensitivity: 'base' });
      }
      if (sortBy === 'year-desc') {
        const yearA = parseInt(a.publicationYear || '0', 10) || 0;
        const yearB = parseInt(b.publicationYear || '0', 10) || 0;
        return yearB - yearA;
      }
      if (sortBy === 'recent') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });
  }, [books, selectedAvailability, selectedGenre, selectedAgeGroup, searchQuery, sortBy]);

  // Active filters count
  const activeFiltersCount =
    (selectedGenre !== 'Tutti' ? 1 : 0) +
    (selectedAgeGroup !== 'Tutti' ? 1 : 0) +
    (selectedAvailability !== 'all' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const narrativeCount = useMemo(() => {
    return books.filter((b) => b.genre === 'Narrativa').length;
  }, [books]);

  const resetAllFilters = () => {
    setSelectedGenre('Tutti');
    setSelectedAgeGroup('Tutti');
    setSelectedAvailability('all');
    setSearchQuery('');
    setSortBy('title-asc');
    triggerScanFeedback('info', 'Filtri azzerati');
  };

  // Popular genres that actually have books in catalog for quick pills
  const popularActiveGenres = useMemo(() => {
    return availableGenres
      .filter((g) => g !== 'Tutti' && (genreCounts[g] || 0) > 0)
      .slice(0, 8);
  }, [availableGenres, genreCounts]);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Library className="w-6 h-6 text-indigo-600" />
            <span>Catalogo Biblioteca Scolastica</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {books.length} volumi
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catalogazione con ISBN, ricerca avanzata per genere ed età, supporto lettore barcode USB
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {books.length > 0 && (
            <button
              type="button"
              onClick={handleAutoFixCatalogGenres}
              disabled={isReclassifying}
              className="px-3 py-2 bg-gradient-to-r from-amber-50 to-indigo-50 hover:from-amber-100 hover:to-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Rianalizza tutti i libri del catalogo e assegna automaticamente genere e fascia d'età appropriati (utile se hai libri inseriti come generica 'Narrativa')"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Rianalizza Generi ed Età</span>
            </button>
          )}

          {books.length > 0 && (
            <button
              type="button"
              onClick={() => setIsPrintBarcodesOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Stampa foglio etichette con barcode per dorsi libro"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Stampa Etichette Barcode</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cataloga Nuovo Libro</span>
          </button>
        </div>
      </div>

      {/* Helper alert if user has multiple generic Narrativa books */}
      {narrativeCount >= 2 && (
        <div className="p-3.5 bg-gradient-to-r from-amber-50/90 to-indigo-50/70 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5 text-slate-800">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900">Controllo Generi Catalogo:</span>{' '}
              <span>
                Sono presenti <strong>{narrativeCount} libri</strong> registrati con il genere generico &ldquo;Narrativa&rdquo;. Puoi avviare la rianalisi automatica per attribuire a ciascuno il genere specifico (Fantasy, Giallo, Fumetti, Avventura, Fiabe, Scienza, ecc.) e la fascia d&apos;età raccomandata.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAutoFixCatalogGenres}
            disabled={isReclassifying}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shrink-0 transition cursor-pointer shadow-xs flex items-center gap-1.5 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Correggi Generi ed Età ({narrativeCount})</span>
          </button>
        </div>
      )}

      {/* Advanced Filter & Search Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Search Bar with USB Scanner friendly autofocus */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per Titolo, Autore, Genere, Fascia Età, ISBN o spara con barcode scanner USB..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition"
                title="Cancella ricerca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-between md:justify-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="title-asc">Ordina: Titolo (A - Z)</option>
                <option value="title-desc">Ordina: Titolo (Z - A)</option>
                <option value="recent">Ordina: Ultimi Aggiunti</option>
                <option value="year-desc">Ordina: Anno Pubblicazione</option>
                <option value="author-asc">Ordina: Autore (A - Z)</option>
              </select>
            </div>

            {/* View mode toggle (Grid / Table) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista a griglia con copertine"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista elenco a tabella"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar: Genere, Fascia Età, Disponibilità */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filtri Catalogo:</span>
          </div>

          {/* 1. FILTRO GENERE */}
          <div className="relative">
            <div className="flex items-center">
              <label
                htmlFor="genre-filter"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-xs ${
                  selectedGenre !== 'Tutti'
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <BookMarked className={`w-3.5 h-3.5 ${selectedGenre !== 'Tutti' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-[11px] text-slate-500 font-medium">Genere:</span>
                <select
                  id="genre-filter"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="Tutti">Tutti i Generi ({books.length})</option>
                  {availableGenres
                    .filter((g) => g !== 'Tutti')
                    .map((g) => {
                      const count = genreCounts[g] || 0;
                      return (
                        <option key={g} value={g}>
                          {g} ({count})
                        </option>
                      );
                    })}
                </select>
              </label>
            </div>
          </div>

          {/* 2. FILTRO FASCIA D'ETÀ */}
          <div className="relative">
            <div className="flex items-center">
              <label
                htmlFor="age-filter"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shadow-xs ${
                  selectedAgeGroup !== 'Tutti'
                    ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <GraduationCap className={`w-3.5 h-3.5 ${selectedAgeGroup !== 'Tutti' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-[11px] text-slate-500 font-medium">Fascia Età:</span>
                <select
                  id="age-filter"
                  value={selectedAgeGroup}
                  onChange={(e) => setSelectedAgeGroup(e.target.value)}
                  className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer pr-1"
                >
                  <option value="Tutti">Tutte le Età ({books.length})</option>
                  {availableAgeGroups
                    .filter((a) => a !== 'Tutti')
                    .map((a) => {
                      const count = ageCounts[a] || 0;
                      return (
                        <option key={a} value={a}>
                          {a} ({count})
                        </option>
                      );
                    })}
                </select>
              </label>
            </div>
          </div>

          {/* 3. FILTRO DISPONIBILITÀ */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setSelectedAvailability('all')}
              className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                selectedAvailability === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Tutti
            </button>
            <button
              type="button"
              onClick={() => setSelectedAvailability('available')}
              className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
                selectedAvailability === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Disponibili</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedAvailability('loaned')}
              className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
                selectedAvailability === 'loaned'
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <span>In Prestito</span>
            </button>
          </div>

          {/* Results Summary Counter */}
          <div className="text-xs text-slate-500 font-semibold ml-auto hidden sm:flex items-center gap-1.5">
            <span>Trovati:</span>
            <strong className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
              {filteredBooks.length} su {books.length}
            </strong>
          </div>
        </div>

        {/* Quick Age Group Pills (Fasce d'Età Rapide - Filtro Immediato) */}
        <div className="pt-2 border-t border-slate-100/90 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mr-1 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
            <span>Fascia Età:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedAgeGroup('Tutti')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              selectedAgeGroup === 'Tutti'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
                : 'bg-amber-50/60 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
          >
            <span>Tutte le Età</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedAgeGroup === 'Tutti' ? 'bg-amber-700 text-white' : 'bg-amber-200/70 text-amber-900'
            }`}>
              {books.length}
            </span>
          </button>
          {availableAgeGroups
            .filter((a) => a !== 'Tutti')
            .map((ageOption) => {
              const isSelected = selectedAgeGroup === ageOption;
              const count = ageCounts[ageOption] || 0;
              const badgeInfo = getAgeGroupBadge(ageOption);
              return (
                <button
                  key={ageOption}
                  type="button"
                  onClick={() => setSelectedAgeGroup(isSelected ? 'Tutti' : ageOption)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs font-bold'
                      : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
                  <span>{badgeInfo.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
        </div>

        {/* Quick Genre Pills (Generi Rapidi - Filtro Immediato) */}
        <div className="pt-2 border-t border-slate-100/80 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider mr-1 flex items-center gap-1">
            <BookMarked className="w-3.5 h-3.5 text-indigo-600" />
            <span>Generi Rapidi:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedGenre('Tutti')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              selectedGenre === 'Tutti'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                : 'bg-indigo-50/60 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
            }`}
          >
            <span>Tutti i Generi</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              selectedGenre === 'Tutti' ? 'bg-indigo-700 text-white' : 'bg-indigo-200/70 text-indigo-900'
            }`}>
              {books.length}
            </span>
          </button>
          {popularActiveGenres.map((g) => {
            const isSelected = selectedGenre === g;
            const count = genreCounts[g] || 0;
            return (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedGenre(isSelected ? 'Tutti' : g)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Tag className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                <span>{g}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Filters Bar (Dismissable Pills & Reset Button) */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-indigo-50 flex flex-wrap items-center gap-2 text-xs bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100">
            <span className="font-bold text-indigo-900 text-xs flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>Filtri attivi ({activeFiltersCount}):</span>
            </span>

            {/* Genre active pill */}
            {selectedGenre !== 'Tutti' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                <span>Genere: {selectedGenre}</span>
                <button
                  type="button"
                  onClick={() => setSelectedGenre('Tutti')}
                  className="hover:bg-indigo-700 rounded-full p-0.5 transition cursor-pointer"
                  title="Rimuovi filtro genere"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Age active pill */}
            {selectedAgeGroup !== 'Tutti' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-xs shadow-xs">
                <span>Età: {selectedAgeGroup}</span>
                <button
                  type="button"
                  onClick={() => setSelectedAgeGroup('Tutti')}
                  className="hover:bg-amber-700 rounded-full p-0.5 transition cursor-pointer"
                  title="Rimuovi filtro età"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Availability active pill */}
            {selectedAvailability !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-white font-bold text-xs shadow-xs">
                <span>Stato: {selectedAvailability === 'available' ? 'Solo Disponibili' : 'Solo in Prestito'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedAvailability('all')}
                  className="hover:bg-slate-700 rounded-full p-0.5 transition cursor-pointer"
                  title="Rimuovi filtro disponibilità"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Query active pill */}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs">
                <span>Ricerca: &ldquo;{searchQuery}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:bg-slate-300 rounded-full p-0.5 transition cursor-pointer"
                  title="Cancella ricerca"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Reset All Filters Button */}
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
              title="Azzera tutti i filtri di ricerca"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Azzera tutti i filtri</span>
            </button>
          </div>
        )}
      </div>

      {/* Catalog Display: Empty State vs Filter Zero Results vs Grid vs Table */}
      {books.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Il catalogo della biblioteca è vuoto</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Non è ancora presente alcun libro in archivio. Inizia a catalogare i primi volumi
            scansionando il codice a barre ISBN con il lettore USB, oppure tramite la fotocamera con
            riconoscimento OCR.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cataloga il Tuo Primo Libro</span>
          </button>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-xs space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
            <Filter className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Nessun libro corrisponde ai filtri selezionati
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {selectedGenre !== 'Tutti' && `• Genere: ${selectedGenre} `}
            {selectedAgeGroup !== 'Tutti' && `• Fascia Età: ${selectedAgeGroup} `}
            {selectedAvailability !== 'all' && `• Stato: ${selectedAvailability} `}
            {searchQuery && `• Testo: "${searchQuery}"`}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mostra Tutti i {books.length} Libri</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ==================== GRID VIEW ==================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredBooks.map((book) => {
            const isAvailable = book.copiesAvailable > 0;
            const ageBadge = getAgeGroupBadge(book.ageGroup);

            return (
              <div
                key={book.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Book Cover Container */}
                  <div
                    onClick={() => setSelectedBookForDetail(book)}
                    className="h-56 bg-slate-900 relative overflow-hidden flex items-center justify-center cursor-pointer border-b border-slate-100"
                  >
                    <BookCoverImage
                      coverUrl={book.coverUrl}
                      title={book.title}
                      authors={book.authors}
                      genre={book.genre}
                      isbn={book.isbn}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Badge availability (Top Right) */}
                    <div className="absolute top-2.5 right-2.5">
                      {isAvailable ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                          {book.copiesAvailable} disp.
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                          In Prestito
                        </span>
                      )}
                    </div>

                    {/* Genre pill (Bottom Left, Clickable to filter) */}
                    <div className="absolute bottom-2 left-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGenre(book.genre);
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/85 hover:bg-indigo-600 backdrop-blur-xs text-white transition flex items-center gap-1 cursor-pointer"
                        title={`Filtra catalogo per genere: ${book.genre}`}
                      >
                        <Tag className="w-2.5 h-2.5 text-indigo-300" />
                        <span>{book.genre}</span>
                      </button>
                    </div>

                    {/* Age group pill (Bottom Right, Clickable to filter) */}
                    {book.ageGroup && (
                      <div className="absolute bottom-2 right-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgeGroup(book.ageGroup);
                          }}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/85 hover:bg-amber-600 backdrop-blur-xs text-amber-200 transition flex items-center gap-1 cursor-pointer"
                          title={`Filtra catalogo per età: ${book.ageGroup}`}
                        >
                          <GraduationCap className="w-2.5 h-2.5 text-amber-400" />
                          <span>{ageBadge.short}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Metadata Info */}
                  <div className="p-4 cursor-pointer" onClick={() => setSelectedBookForDetail(book)}>
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition">
                      {book.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 font-medium truncate">
                      {(book.authors || []).join(', ')}
                    </p>

                    {/* Genre and Age Group Metadata Row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGenre(book.genre);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                          selectedGenre === book.genre
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                        title="Clicca per filtrare per questo genere"
                      >
                        {book.genre}
                      </button>

                      {book.ageGroup && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAgeGroup(book.ageGroup);
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                            selectedAgeGroup === book.ageGroup
                              ? 'bg-amber-600 text-white border-amber-600'
                              : `${ageBadge.color} hover:opacity-90`
                          }`}
                          title="Clicca per filtrare per questa fascia d'età"
                        >
                          {ageBadge.label}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{book.collocazione}</span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{book.inventoryCode}</span>
                      {book.publicationYear && <span>Anno: {book.publicationYear}</span>}
                    </div>
                  </div>
                </div>

                {/* Card footer action */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBookForDetail(book)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                  >
                    Dettagli
                  </button>

                  {isAvailable && onLoanBook ? (
                    <button
                      type="button"
                      onClick={() => onLoanBook(book)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Presta</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Non disponibile</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== TABLE VIEW ==================== */
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Libro</th>
                  <th className="py-3 px-4">Genere</th>
                  <th className="py-3 px-4">Fascia Età</th>
                  <th className="py-3 px-4">Collocazione</th>
                  <th className="py-3 px-4">Cod. Inventario</th>
                  <th className="py-3 px-4">Disponibilità</th>
                  <th className="py-3 px-4 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.map((book) => {
                  const isAvailable = book.copiesAvailable > 0;
                  const ageBadge = getAgeGroupBadge(book.ageGroup);

                  return (
                    <tr
                      key={book.id}
                      onClick={() => setSelectedBookForDetail(book)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-11 rounded shadow-xs overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
                            <BookCoverImage
                              coverUrl={book.coverUrl}
                              title={book.title}
                              authors={book.authors}
                              genre={book.genre}
                              isbn={book.isbn}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-snug line-clamp-1">
                              {book.title}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {(book.authors || []).join(', ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGenre(book.genre);
                          }}
                          className="px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                          title="Filtra per questo genere"
                        >
                          {book.genre}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {book.ageGroup ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgeGroup(book.ageGroup);
                            }}
                            className={`px-2 py-0.5 rounded-md text-xs font-bold border transition cursor-pointer ${ageBadge.color} hover:opacity-90`}
                            title="Filtra per questa fascia d'età"
                          >
                            {ageBadge.label}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">n/d</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs font-semibold whitespace-nowrap">
                        {book.collocazione}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {book.inventoryCode}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {book.copiesAvailable} / {book.copiesTotal} disp.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            <Clock className="w-3.5 h-3.5" />
                            In Prestito
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isAvailable && onLoanBook && (
                          <button
                            type="button"
                            onClick={() => onLoanBook(book)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            Presta
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {!externalOnOpenAdd && isAddModalOpen && (
        <AddBookModal
          isOpen={isAddModalOpen}
          onClose={handleCloseAddModal}
          onBookAdded={(newB) => {
            setSelectedBookForDetail(newB);
          }}
        />
      )}

      {selectedBookForDetail && (
        <BookDetailModal
          book={selectedBookForDetail}
          isOpen={!!selectedBookForDetail}
          onClose={() => setSelectedBookForDetail(null)}
          onLoanBook={onLoanBook}
        />
      )}

      {isPrintBarcodesOpen && (
        <PrintBarcodesModal
          books={books}
          isOpen={isPrintBarcodesOpen}
          onClose={() => setIsPrintBarcodesOpen(false)}
        />
      )}
    </div>
  );
};
