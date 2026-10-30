import React, { useState, useRef, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, GENRE_OPTIONS, AGE_GROUP_OPTIONS } from '../../types';
import { BookCoverImage } from './BookCoverImage';
import { generateBookCoverDataUrl } from '../../utils/coverGenerator';
import { classifyBook, BookClassification } from '../../utils/bookClassifier';
import { searchBookByIsbn, ocrBookImage } from '../../services/onlineBookSearch';
import {
  X,
  Barcode,
  Search,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Image as ImageIcon,
  RefreshCw,
  Globe,
  Database,
  Palette
} from 'lucide-react';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAdded?: (book: Book) => void;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, onClose, onBookAdded }) => {
  const { books, addBook, triggerScanFeedback, settings } = useLibrary();

  // Mode: 'isbn' (Open Library / Google Books) | 'ai_ocr' (Frontespizio image) | 'manual'
  const [activeTab, setActiveTab] = useState<'isbn' | 'ai_ocr' | 'manual'>('isbn');

  // Scanner / Search Input
  const [isbnInput, setIsbnInput] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineLookupError, setOnlineLookupError] = useState<string | null>(null);
  const [lookupSource, setLookupSource] = useState<string | null>(null);

  // Gemini OCR Image state
  const [ocrImageFile, setOcrImageFile] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publicationYear, setPublicationYear] = useState('');
  const [isbn, setIsbn] = useState('');
  const [inventoryCode, setInventoryCode] = useState('');
  const [genre, setGenre] = useState<string>(GENRE_OPTIONS[0]);
  const [ageGroup, setAgeGroup] = useState<string>(AGE_GROUP_OPTIONS[1]);
  const [collocazione, setCollocazione] = useState('Sede Centrale - Scaffale A - Ripiano 1');
  const [synopsis, setSynopsis] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [copiesTotal, setCopiesTotal] = useState<number>(1);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<Array<{ source: string; url: string }>>([]);
  const [isSearchingOriginalCovers, setIsSearchingOriginalCovers] = useState(false);
  const [detectedClassification, setDetectedClassification] = useState<BookClassification | null>(null);

  const isbnInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate next inventory code and reset fields when modal opens
  useEffect(() => {
    if (isOpen) {
      const nextNum = books.length + 1;
      setInventoryCode(`LIB-${String(nextNum).padStart(4, '0')}`);
      setIsbnInput('');
      setOnlineLookupError(null);
      setLookupSource(null);
      setDetectedClassification(null);
      setTitle('');
      setAuthors('');
      setPublisher('');
      setPublicationYear('');
      setIsbn('');
      setGenre(GENRE_OPTIONS[0]);
      setAgeGroup(AGE_GROUP_OPTIONS[1]);
      setCollocazione('Sede Centrale - Scaffale A - Ripiano 1');
      setSynopsis('');
      setCoverUrl('');
      setCoverCandidates([]);
      setCopiesTotal(1);
      setOcrImageFile(null);
      setActiveTab('isbn');
      // Auto-focus the ISBN input for instant USB scanner scan
      setTimeout(() => isbnInputRef.current?.focus(), 100);
    }
  }, [isOpen, books.length]);

  // Check if current ISBN or input already exists in library catalog
  const cleanCurrentIsbn = (isbn || isbnInput).trim().replace(/[^0-9X]/gi, '');
  const existingBookWithIsbn = cleanCurrentIsbn.length >= 10
    ? books.find((b) => b.isbn && b.isbn.replace(/[^0-9X]/gi, '') === cleanCurrentIsbn)
    : undefined;

  if (!isOpen) return null;

  // 1. Perform Online ISBN Lookup with API key fallback, try/catch with console error, and public APIs (Google Books / Open Library)
  const handleIsbnLookup = async (codeToSearch?: string) => {
    const targetIsbn = (codeToSearch || isbnInput).trim().replace(/[^0-9X]/gi, '');
    if (!targetIsbn) {
      setOnlineLookupError('Inserisci o scansiona un codice ISBN valido (10 o 13 cifre)');
      return;
    }

    setIsSearchingOnline(true);
    setOnlineLookupError(null);
    setLookupSource(null);

    try {
      console.info(`[AddBookModal] Avvio ricerca per ISBN: ${targetIsbn}...`);
      const data = await searchBookByIsbn(targetIsbn, {
        isbndbApiKey: settings?.isbndbApiKey,
        worldcatWskey: settings?.worldcatWskey,
        librarythingDevKey: settings?.librarythingDevKey,
        schoolName: settings?.schoolName,
      });

      if (data.found) {
        setTitle(data.title || '');
        const authStr = Array.isArray(data.authors) ? data.authors.join(', ') : '';
        setAuthors(authStr);
        setPublisher(data.publisher || '');
        setPublicationYear(data.publicationYear || '');
        setIsbn(data.isbn || targetIsbn);
        if (data.description) setSynopsis(data.description);

        // Accurate classification (school genre and recommended age)
        const classification = classifyBook(
          data.title || '',
          data.authors || [],
          data.description || '',
          data.categories || [],
          ''
        );
        const resolvedGenre = data.genre || classification.genre;
        const resolvedAge = data.ageGroup || classification.ageGroup;
        setGenre(resolvedGenre);
        setAgeGroup(resolvedAge);
        setDetectedClassification({ ...classification, genre: resolvedGenre, ageGroup: resolvedAge });

        // Set or guarantee cover
        if (data.coverCandidates && Array.isArray(data.coverCandidates)) {
          setCoverCandidates(data.coverCandidates);
        } else {
          setCoverCandidates([]);
        }

        if (data.coverUrl) {
          setCoverUrl(data.coverUrl);
        } else {
          const guaranteed = generateBookCoverDataUrl(
            data.title || 'Nuovo Libro',
            authStr || 'Autore',
            resolvedGenre,
            settings?.schoolName
          );
          setCoverUrl(guaranteed);
        }

        setLookupSource(data.source || 'Banche Dati Bibliotecarie');
        const srcName = data.source || 'Banche dati';
        triggerScanFeedback('success', `Trovato su ${srcName}: "${data.title}" con copertina!`);
      } else {
        // Not found on public DB or Gemini
        setIsbn(targetIsbn);
        setOnlineLookupError(
          data.message || 'Nessun dato trovato per questo ISBN nelle banche dati collegate. Puoi inserire i dati a mano o scattare una foto al frontespizio.'
        );
        triggerScanFeedback('error', 'ISBN non trovato nelle banche dati collegate.');
      }
    } catch (err: any) {
      console.error('[AddBookModal] ERRORE DETTAGLIATO RICERCA ONLINE ISBN:', {
        isbn: targetIsbn,
        errorMessage: err?.message || String(err),
        stack: err?.stack,
        error: err,
      });
      setOnlineLookupError(
        `Errore durante la ricerca online: ${err?.message || 'verifica la connessione internet'}. Consulta la console per i dettagli completi.`
      );
      triggerScanFeedback('error', 'Errore durante la ricerca online dell\'ISBN.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // 2. Gemini Frontespizio OCR Fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOcrImageFile(base64);
      setCoverUrl(base64); // optionally set cover directly from uploaded photo!
      await analyzeImageWithGemini(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImageWithGemini = async (base64: string, mimeType: string) => {
    setIsOcrProcessing(true);
    setOnlineLookupError(null);

    try {
      const res = await ocrBookImage(base64, mimeType);

      if (res.success && res.data) {
        const d = res.data;
        if (d.title) setTitle(d.title);
        if (d.authors) setAuthors(Array.isArray(d.authors) ? d.authors.join(', ') : d.authors);
        if (d.publisher) setPublisher(d.publisher);
        if (d.publicationYear) setPublicationYear(d.publicationYear);
        if (d.isbn) setIsbn(d.isbn);
        if (d.description) setSynopsis(d.description);

        const classification = classifyBook(
          d.title || '',
          d.authors || '',
          d.description || '',
          d.categories || [],
          ''
        );
        const resolvedGenre = d.genre && d.genre !== 'Narrativa' ? d.genre : classification.genre;
        const resolvedAge = d.ageGroup ? d.ageGroup : classification.ageGroup;
        setGenre(resolvedGenre);
        setAgeGroup(resolvedAge);
        setDetectedClassification({ ...classification, genre: resolvedGenre, ageGroup: resolvedAge });

        triggerScanFeedback('success', `Analisi AI completata! Estratto: "${d.title}" (${resolvedGenre})`);
      } else {
        setOnlineLookupError(res.error || 'L\'AI non è riuscita a estrarre dati sufficienti dall\'immagine.');
      }
    } catch (e: any) {
      console.error('[AddBookModal] ERRORE DETTAGLIATO OCR FRONTESPIZIO:', {
        errorMessage: e?.message || String(e),
        stack: e?.stack,
        error: e,
      });
      setOnlineLookupError('Errore durante l\'analisi con Gemini Vision OCR. Dettagli in console.');
      triggerScanFeedback('error', 'Errore elaborazione OCR immagine');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Helper to manually run intelligent classification on currently entered title/author/synopsis
  const handleAutoDetectGenreAndAge = () => {
    if (!title.trim() && !authors.trim()) {
      triggerScanFeedback('info', 'Inserisci o scansiona prima il titolo o l\'autore del libro per eseguire il rilevamento.');
      return;
    }
    const classification = classifyBook(title, authors, synopsis, [], '');
    setGenre(classification.genre);
    setAgeGroup(classification.ageGroup);
    setDetectedClassification(classification);
    triggerScanFeedback('success', `Rilevato: Genere "${classification.genre}" • Fascia Età "${classification.ageGroup}"`);
  };

  // 3. AI Book Cover Generator with Gemini + SVG fallback
  const handleGenerateAiCover = async () => {
    const currentTitle = title.trim();
    if (!currentTitle && !isbn.trim() && !isbnInput.trim()) {
      triggerScanFeedback('error', 'Inserisci o cerca prima il titolo del libro per generare la copertina!');
      return;
    }

    setIsGeneratingAiCover(true);
    triggerScanFeedback('info', 'Generazione copertina artistica con Gemini AI in corso...');

    try {
      const res = await fetch('/api/gemini/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentTitle || 'Nuovo Libro',
          authors: authors || 'Autore',
          genre,
          synopsis,
          isbn: isbn || isbnInput,
          schoolName: settings?.schoolName,
        }),
      });

      const data = await res.json();
      if (data.success && data.coverUrl) {
        setCoverUrl(data.coverUrl);
        triggerScanFeedback('success', 'Nuova copertina generata con successo da Gemini AI!');
      } else {
        const fallback = generateBookCoverDataUrl(
          currentTitle || 'Nuovo Libro',
          authors || 'Autore',
          genre,
          settings?.schoolName
        );
        setCoverUrl(fallback);
        triggerScanFeedback('success', 'Copertina grafica scolastica impostata!');
      }
    } catch (err) {
      console.error('Error generating AI cover:', err);
      const fallback = generateBookCoverDataUrl(
        currentTitle || 'Nuovo Libro',
        authors || 'Autore',
        genre,
        settings?.schoolName
      );
      setCoverUrl(fallback);
      triggerScanFeedback('success', 'Copertina grafica generata (modalità fallback)!');
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  // 4. Dedicated Original Cover Finder (Amazon IT CDN, Google Books Content, Open Library)
  const handleSearchOriginalCovers = async () => {
    const targetIsbn = (isbn || isbnInput).trim().replace(/[^0-9X]/gi, '');
    if (!targetIsbn) {
      triggerScanFeedback('error', 'Inserisci o scansiona prima un codice ISBN valido per rintracciare la copertina originale.');
      return;
    }

    setIsSearchingOriginalCovers(true);
    triggerScanFeedback('info', 'Ricerca copertina originale dell\'editore in corso...');
    try {
      const res = await fetch(`/api/cover-lookup/${encodeURIComponent(targetIsbn)}`);
      const data = await res.json();
      if (data.found && data.coverUrl) {
        setCoverUrl(data.coverUrl);
        if (data.coverCandidates && Array.isArray(data.coverCandidates)) {
          setCoverCandidates(data.coverCandidates);
        }
        triggerScanFeedback('success', `Copertina originale trovata: ${data.source}!`);
      } else {
        triggerScanFeedback('error', 'Nessuna copertina fotografica originale trovata per questa edizione.');
      }
    } catch {
      triggerScanFeedback('error', 'Errore di connessione durante la ricerca della copertina.');
    } finally {
      setIsSearchingOriginalCovers(false);
    }
  };

  // Submit book
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      triggerScanFeedback('error', 'Il titolo del libro è obbligatorio.');
      return;
    }

    const authorList = authors
      .split(/[,;/]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const newBook = addBook({
      inventoryCode: inventoryCode.trim() || `LIB-${Date.now()}`,
      isbn: isbn.trim() || undefined,
      title: title.trim(),
      authors: authorList.length > 0 ? authorList : ['Autore sconosciuto'],
      publisher: publisher.trim() || undefined,
      publicationYear: publicationYear.trim() || undefined,
      genre,
      ageGroup,
      collocazione: collocazione.trim() || 'Scaffale Biblioteca',
      coverUrl: coverUrl.trim() || undefined,
      synopsis: synopsis.trim() || undefined,
      copiesTotal: Number(copiesTotal) || 1,
      copiesAvailable: Number(copiesTotal) || 1,
      status: 'Disponibile',
    });

    triggerScanFeedback('success', `Libro aggiunto con successo: "${newBook.title}"`);
    if (onBookAdded) onBookAdded(newBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Catalogazione Nuovo Libro</h3>
              <p className="text-xs text-slate-300">
                Recupero automatico metadati e copertina via ISBN o analisi AI frontespizio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cataloging Method Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('isbn')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'isbn'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>1. Scansione ISBN / Web API</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai_ocr')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'ai_ocr'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>2. Gemini Vision OCR Frontespizio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'manual'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>3. Inserimento Manuale</span>
          </button>
        </div>

        {/* Method Panels */}
        <div className="p-6">
          {/* Method 1: ISBN Quick Lookup */}
          {activeTab === 'isbn' && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Scansiona ISBN con lettore USB o inseriscilo manualmente:</span>
                </label>
              </div>

              {/* Bibliographic Databases Connected Badges */}
              <div className="mb-3 p-2 rounded-lg bg-white/90 border border-indigo-100 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-indigo-600" /> Banche Dati Collegate:
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title="Bibliografia Nazionale Italiana - Deposito legale BNCF Firenze">
                  🏛️ BNI (BNCF Firenze)
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200" title="Catalogo Ufficiale delle Biblioteche Italiane (ICCU)">
                  🇮🇹 OPAC SBN
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="LibraryThing ThingISBN per correlazione edizioni e copertine">
                  📚 LibraryThing (ThingISBN)
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-blue-50 text-blue-800 border border-blue-200" title="Il più grande catalogo bibliografico mondiale">
                  🌐 WorldCat / OCLC
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-purple-50 text-purple-800 border border-purple-200" title="Database commerciale mondiale con 30M+ volumi e copertine HQ">
                  ⭐ ISBNdb (30M+ Libri)
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200" title="Indice accademico per saggi, testi universitari e DOI">
                  🎓 Crossref Saggi
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Archivio mondiale aperto con milioni di copertine e testi">
                  📖 Open Library & Google Books
                </span>
                <span className="px-2 py-0.5 rounded-md font-semibold bg-violet-50 text-violet-800 border border-violet-200" title="Arricchimento semantico, sinossi scolastiche e OCR">
                  ✨ Gemini AI
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="w-5 h-5 text-indigo-400 absolute left-3 top-2.5" />
                  <input
                    ref={isbnInputRef}
                    type="text"
                    value={isbnInput}
                    onChange={(e) => setIsbnInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleIsbnLookup();
                      }
                    }}
                    placeholder="Esempio: 9788804668237 oppure scansiona il codice a barre sul retro del libro..."
                    className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleIsbnLookup()}
                  disabled={isSearchingOnline || !isbnInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-xs"
                >
                  {isSearchingOnline ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Interrogazione Banche Dati...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Cerca Libro</span>
                    </>
                  )}
                </button>
              </div>

              {lookupSource && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Dati e copertina reperiti da: <strong>{lookupSource}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/60 text-emerald-800 rounded-full">
                    Verificato
                  </span>
                </div>
              )}

              {onlineLookupError && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{onlineLookupError}</span>
                </div>
              )}

              {existingBookWithIsbn && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Attenzione:</strong> Questo libro risulta già presente in biblioteca: &quot;{existingBookWithIsbn.title}&quot; (Cod. {existingBookWithIsbn.inventoryCode}). Se stai registrando una nuova copia fisica dello stesso titolo, puoi procedere normalmente.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Method 2: Gemini OCR Frontespizio */}
          {activeTab === 'ai_ocr' && (
            <div className="mb-6 p-4 rounded-xl bg-purple-50/60 border border-purple-200">
              <div className="flex items-center gap-2 mb-2 text-purple-950 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Riconoscimento intelligente Frontespizio / Copertina con Gemini</span>
              </div>
              <p className="text-xs text-purple-800 mb-3">
                Scatta o carica una foto del frontespizio (o della copertina con titolo e autore).
                L&apos;AI analizzerà visivamente l&apos;immagine estraendo titolo, autore, editore, anno e
                genere scolastico.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isOcrProcessing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition"
                >
                  {isOcrProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analisi Gemini in corso...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Carica / Scatta Foto Frontespizio</span>
                    </>
                  )}
                </button>

                {ocrImageFile && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Immagine caricata ed elaborata
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Form: Book Details */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Cover Preview & Controls */}
              <div className="sm:w-44 shrink-0 flex flex-col items-center">
                <div className="w-36 h-52 bg-slate-900 border border-slate-200 rounded-xl overflow-hidden shadow-md flex items-center justify-center relative group">
                  <BookCoverImage
                    coverUrl={coverUrl}
                    title={title || 'Titolo Libro'}
                    authors={authors ? [authors] : []}
                    genre={genre}
                    isbn={isbn || isbnInput}
                    schoolName={settings?.schoolName}
                    className="w-full h-full object-cover"
                  />
                  {coverUrl && !coverUrl.startsWith('data:') && (
                    <div className="absolute top-1 right-1 bg-emerald-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5 backdrop-blur-xs">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>Originale</span>
                    </div>
                  )}
                </div>

                {/* Discovered Authentic Publisher Covers Picker */}
                {coverCandidates.length > 0 && (
                  <div className="w-full mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[9px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Edizioni originali ({coverCandidates.length}):</span>
                      <span className="text-[8px] text-emerald-700 font-bold bg-emerald-100/60 px-1 py-0.5 rounded">
                        100% Autentica
                      </span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
                      {coverCandidates.map((cand, idx) => {
                        const isSelected = coverUrl === cand.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCoverUrl(cand.url);
                              triggerScanFeedback('success', `Copertina selezionata: ${cand.source}`);
                            }}
                            className={`shrink-0 w-10 h-14 rounded border overflow-hidden transition relative cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-indigo-600 border-transparent shadow-sm'
                                : 'border-slate-300 opacity-60 hover:opacity-100'
                            }`}
                            title={`Clicca per usare: ${cand.source}`}
                          >
                            <img src={cand.url} alt={cand.source} className="w-full h-full object-cover" />
                            {isSelected && (
                              <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5 text-white drop-shadow" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Cover Buttons */}
                <div className="w-full mt-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleSearchOriginalCovers}
                    disabled={isSearchingOriginalCovers}
                    className="w-full px-2 py-1 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition"
                    title="Cerca copertina originale pubblicata dall'editore italiano su Amazon IT e Google Books"
                  >
                    {isSearchingOriginalCovers ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Ricerca originale...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3" />
                        <span>Cerca Copertina Originale</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAiCover}
                    disabled={isGeneratingAiCover}
                    className="w-full px-2 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 active:scale-95"
                    title="Genera copertina artistica personalizzata per la trama del libro con Gemini AI"
                  >
                    {isGeneratingAiCover ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generazione AI in corso...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        <span>Genera Copertina AI</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generateBookCoverDataUrl(
                          title || 'Nuovo Libro',
                          authors || 'Autore',
                          genre,
                          settings?.schoolName
                        );
                        setCoverUrl(generated);
                        triggerScanFeedback('success', 'Stile grafico scolastico applicato!');
                      }}
                      className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition"
                      title="Genera copertina grafica standard con colore del genere letterario"
                    >
                      <Palette className="w-3 h-3 text-indigo-600" />
                      <span>Grafica Standard</span>
                    </button>

                    <label className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer text-center">
                      <Camera className="w-3 h-3 text-slate-600" />
                      <span>Carica Foto</span>
                      <input
                        ref={coverImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setCoverUrl(reader.result as string);
                            triggerScanFeedback('success', 'Foto copertina caricata!');
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="w-full mt-1.5">
                  <input
                    type="url"
                    placeholder="Incolla URL copertina web..."
                    value={coverUrl.startsWith('data:') ? '' : coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    className="w-full text-[10px] p-1.5 border border-slate-300 rounded-lg text-slate-600"
                    title="URL immagine copertina web o incolla link diretto"
                  />
                </div>
              </div>

              {/* Main Fields */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Titolo del Libro *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Es. Il Piccolo Principe, Harry Potter, Marcovaldo..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Autore / Autori *
                    </label>
                    <input
                      type="text"
                      value={authors}
                      onChange={(e) => setAuthors(e.target.value)}
                      placeholder="Es. Antoine de Saint-Exupéry, Gianni Rodari"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Editore</label>
                    <input
                      type="text"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      placeholder="Es. Mondadori Ragazzi, Einaudi, Salani"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anno Pubblicazione
                    </label>
                    <input
                      type="text"
                      value={publicationYear}
                      onChange={(e) => setPublicationYear(e.target.value)}
                      placeholder="Es. 2021"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ISBN</label>
                    <input
                      type="text"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      placeholder="978..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cod. Inventario *
                    </label>
                    <input
                      type="text"
                      value={inventoryCode}
                      onChange={(e) => setInventoryCode(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono font-bold text-indigo-700 bg-slate-50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Copie Totali
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={copiesTotal}
                      onChange={(e) => setCopiesTotal(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Classification: Genre, Age Group, Collocazione */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Classificazione Scolastica (Genere & Fascia d&apos;Età)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoDetectGenreAndAge}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                  title="Ricalcola automaticamente il genere e la fascia d'età dal titolo e autore"
                >
                  <RefreshCw className="w-3 h-3 text-indigo-600" />
                  <span>Rileva Automaticamente</span>
                </button>
              </div>

              {detectedClassification && (
                <div className="px-3 py-2 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-slate-700">
                      Rilevato: Genere <strong className="text-indigo-900">{genre}</strong> • Fascia Età <strong className="text-indigo-900">{ageGroup}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    Modificabile dai menu
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Genere / Categoria *
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fascia d&apos;Età Consigliata *
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {AGE_GROUP_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Collocazione (Scaffale/Ripiano) *
                </label>
                <input
                  type="text"
                  value={collocazione}
                  onChange={(e) => setCollocazione(e.target.value)}
                  placeholder="Es. Scaffale A - Ripiano 2"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  required
                />
              </div>
            </div>
          </div>

          {/* Synopsis */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sinossi / Descrizione Breve (utile per la Ricerca AI)
              </label>
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={3}
                placeholder="Breve trama del libro per incuriosire alunni e docenti..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salva Libro a Catalogo</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
