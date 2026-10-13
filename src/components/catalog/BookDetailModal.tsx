import React, { useState, useRef } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, GENRE_OPTIONS, AGE_GROUP_OPTIONS } from '../../types';
import { generateBarcodeSvg } from '../../utils/barcode';
import { BookCoverImage } from './BookCoverImage';
import { generateBookCoverDataUrl } from '../../utils/coverGenerator';
import { classifyBook } from '../../utils/bookClassifier';
import {
  X,
  Edit2,
  Trash2,
  Check,
  BookOpen,
  MapPin,
  Calendar,
  Building,
  Layers,
  ArrowLeftRight,
  RefreshCw,
  Camera,
  Sparkles,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface BookDetailModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onLoanBook?: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onLoanBook,
}) => {
  const { updateBook, deleteBook, loans, triggerScanFeedback, settings } = useLibrary();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [authors, setAuthors] = useState((book.authors || []).join(', '));
  const [publisher, setPublisher] = useState(book.publisher || '');
  const [publicationYear, setPublicationYear] = useState(book.publicationYear || '');
  const [genre, setGenre] = useState(book.genre);
  const [ageGroup, setAgeGroup] = useState(book.ageGroup);
  const [collocazione, setCollocazione] = useState(book.collocazione);
  const [synopsis, setSynopsis] = useState(book.synopsis || '');
  const [copiesTotal, setCopiesTotal] = useState(book.copiesTotal);
  const [coverUrl, setCoverUrl] = useState(book.coverUrl || '');
  const [isFetchingCover, setIsFetchingCover] = useState(false);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<Array<{ source: string; url: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // History of loans for this book
  const bookLoans = loans.filter((l) => l.bookId === book.id);
  const activeLoan = bookLoans.find((l) => l.status === 'Attivo' || l.status === 'In Ritardo');

  const barcodeSvg = generateBarcodeSvg(book.inventoryCode || book.isbn || 'LIB-0000', {
    height: 44,
    barWidth: 1.5,
    includeText: true,
  });

  // Online Cover Lookup Action
  const handleFetchOnlineCover = async () => {
    const rawIsbn = book.isbn || '';
    const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '');
    if (!cleanIsbn) {
      triggerScanFeedback('info', 'Nessun codice ISBN per questo libro. Puoi caricare una foto o generare la copertina grafica scolastica.');
      return;
    }

    setIsFetchingCover(true);
    triggerScanFeedback('info', `Ricerca copertina online per "${book.title}"...`);
    try {
      const res = await fetch(`/api/cover-lookup/${encodeURIComponent(cleanIsbn)}`);
      const data = await res.json();
      if (data.found && data.coverUrl) {
        updateBook(book.id, { coverUrl: data.coverUrl });
        setCoverUrl(data.coverUrl);
        if (data.coverCandidates && Array.isArray(data.coverCandidates)) {
          setCoverCandidates(data.coverCandidates);
        }
        triggerScanFeedback('success', `Copertina originale recuperata e salvata da ${data.source}!`);
      } else {
        triggerScanFeedback('error', 'Copertina fotografica non reperita nelle banche dati.');
      }
    } catch {
      triggerScanFeedback('error', 'Errore di connessione durante la ricerca della copertina.');
    } finally {
      setIsFetchingCover(false);
    }
  };

  // Upload Photo File Action
  const handleUploadCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      updateBook(book.id, { coverUrl: dataUri });
      setCoverUrl(dataUri);
      triggerScanFeedback('success', 'Nuova foto di copertina salvata!');
    };
    reader.readAsDataURL(file);
  };

  // Generate Artistic Graphic Cover Action
  const handleSetGraphicCover = () => {
    const graphic = generateBookCoverDataUrl(book.title, (book.authors || []).join(', '), book.genre);
    updateBook(book.id, { coverUrl: graphic });
    setCoverUrl(graphic);
    triggerScanFeedback('success', 'Copertina grafica scolastica ad alta definizione impostata!');
  };

  // Generate Custom Thematic AI Cover Action with Gemini
  const handleGenerateAiCover = async () => {
    setIsGeneratingAiCover(true);
    triggerScanFeedback('info', `Generazione copertina artistica con Gemini AI per "${book.title}"...`);
    try {
      const res = await fetch('/api/gemini/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: book.title,
          authors: (book.authors || []).join(', '),
          genre: book.genre,
          synopsis: book.synopsis,
          isbn: book.isbn,
          schoolName: settings?.schoolName,
        }),
      });
      const data = await res.json();
      if (data.success && data.coverUrl) {
        updateBook(book.id, { coverUrl: data.coverUrl });
        setCoverUrl(data.coverUrl);
        triggerScanFeedback('success', 'Nuova copertina generata con successo da Gemini AI!');
      } else {
        handleSetGraphicCover();
      }
    } catch {
      handleSetGraphicCover();
    } finally {
      setIsGeneratingAiCover(false);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAuthors = authors
      .split(/[,;/]/)
      .map((a) => a.trim())
      .filter(Boolean);

    // If copies total changed, adjust copiesAvailable
    const copiesDiff = copiesTotal - book.copiesTotal;
    const newCopiesAvailable = Math.max(0, book.copiesAvailable + copiesDiff);

    updateBook(book.id, {
      title: title.trim(),
      authors: updatedAuthors,
      publisher: publisher.trim() || undefined,
      publicationYear: publicationYear.trim() || undefined,
      genre,
      ageGroup,
      collocazione: collocazione.trim(),
      synopsis: synopsis.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      copiesTotal,
      copiesAvailable: newCopiesAvailable,
      status: newCopiesAvailable > 0 ? 'Disponibile' : 'In Prestito',
    });

    setIsEditing(false);
    triggerScanFeedback('success', `Scheda del libro "${title}" aggiornata con successo!`);
  };

  const handleDelete = () => {
    if (activeLoan) {
      triggerScanFeedback('error', 'Impossibile eliminare un libro attualmente in prestito!');
      return;
    }

    if (window.confirm(`Sei sicuro di voler rimuovere definitivamente "${book.title}" dal catalogo?`)) {
      deleteBook(book.id);
      triggerScanFeedback('info', `Libro "${book.title}" rimosso dal catalogo.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg">Scheda Libro Dettagliata</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Modifica
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition"
                  title="Elimina dal catalogo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                Annulla Modifica
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Titolo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-xl"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Autori</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Editore</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-slate-700">Classificazione:</span>
              <button
                type="button"
                onClick={() => {
                  const classification = classifyBook(title, authors, synopsis, [], '');
                  setGenre(classification.genre);
                  setAgeGroup(classification.ageGroup);
                  triggerScanFeedback('success', `Rilevato: Genere "${classification.genre}" • Età "${classification.ageGroup}"`);
                }}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                title="Rileva automaticamente genere ed età per questo libro"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Rileva con AI/Algoritmo</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Genere</label>
                <input
                  type="text"
                  list="edit-genre-options"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
                <datalist id="edit-genre-options">
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fascia Età</label>
                <input
                  type="text"
                  list="edit-age-options"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
                <datalist id="edit-age-options">
                  {AGE_GROUP_OPTIONS.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Collocazione</label>
                <input
                  type="text"
                  value={collocazione}
                  onChange={(e) => setCollocazione(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Copie Totali</label>
                <input
                  type="number"
                  min={1}
                  value={copiesTotal}
                  onChange={(e) => setCopiesTotal(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">URL Copertina</label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sinossi</label>
              <textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs border rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Salva Modifiche
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            {/* Top Overview with Cover and Key Badges */}
            <div className="flex flex-col sm:flex-row gap-5">
              {/* Cover Column with Action Tools */}
              <div className="sm:w-36 shrink-0 flex flex-col items-center">
                <div className="w-36 h-52 bg-slate-900 border border-slate-200 rounded-xl overflow-hidden shadow-md flex items-center justify-center relative group">
                  <BookCoverImage
                    coverUrl={book.coverUrl}
                    title={book.title}
                    authors={book.authors}
                    genre={book.genre}
                    isbn={book.isbn}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Discovered Authentic Publisher Covers Picker */}
                {coverCandidates.length > 0 && (
                  <div className="w-full mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[9px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Copertine rilevate ({coverCandidates.length}):</span>
                      <span className="text-[8px] text-emerald-700 font-bold bg-emerald-100/60 px-1 py-0.5 rounded">
                        100% Originali
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
                              updateBook(book.id, { coverUrl: cand.url });
                              setCoverUrl(cand.url);
                              triggerScanFeedback('success', `Copertina impostata: ${cand.source}`);
                            }}
                            className={`shrink-0 w-10 h-14 rounded border overflow-hidden transition relative cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-indigo-600 border-transparent shadow-sm'
                                : 'border-slate-300 opacity-60 hover:opacity-100'
                            }`}
                            title={`Usa: ${cand.source}`}
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

                {/* Instant Cover Management Tools */}
                <div className="w-full mt-3 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={handleGenerateAiCover}
                    disabled={isGeneratingAiCover}
                    className="w-full px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                    title="Genera una nuova copertina artistica con Gemini AI basata sulla trama e sul genere"
                  >
                    {isGeneratingAiCover ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generazione AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        <span>Genera Copertina AI</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleFetchOnlineCover}
                    disabled={isFetchingCover}
                    className="w-full px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Cerca la copertina online su Open Library e Google Books"
                  >
                    {isFetchingCover ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Ricerca...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Cerca Copertina Web</span>
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer text-center">
                      <Camera className="w-3 h-3 text-slate-600" />
                      <span>Foto</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadCover}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleSetGraphicCover}
                      className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                      title="Genera copertina grafica standard con titolo e colore tematico"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      <span>Grafica</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      book.copiesAvailable > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {book.copiesAvailable > 0
                      ? `${book.copiesAvailable} copie disponibili`
                      : 'Attualmente in prestito'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {book.genre}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {book.ageGroup}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
                  {book.title}
                </h3>
                <p className="text-sm font-semibold text-slate-600 mt-1">
                  {(book.authors || []).join(', ')}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{book.publisher || 'Editore n/d'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Anno: {book.publicationYear || 'n/d'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800">{book.collocazione}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Copie totali: {book.copiesTotal}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barcode Strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-700">Codice Barcode Inventario</div>
                <div className="text-xs text-slate-500 font-mono">
                  Inventario: {book.inventoryCode} {book.isbn && `• ISBN: ${book.isbn}`}
                </div>
              </div>
              <div
                className="max-w-[180px]"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }}
              />
            </div>

            {/* Synopsis */}
            {book.synopsis && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Trama / Sinossi
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {book.synopsis}
                </p>
              </div>
            )}

            {/* Active Loan Alert / History */}
            {activeLoan && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <div>
                  <span className="font-bold">Attualmente in prestito a:</span> {activeLoan.studentName} ({activeLoan.studentClass})
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    Scadenza: {new Date(activeLoan.dueDate).toLocaleDateString('it-IT')}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Aggiunto il {new Date(book.createdAt).toLocaleDateString('it-IT')}
              </span>
              <div className="flex items-center gap-2">
                {book.copiesAvailable > 0 && onLoanBook && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLoanBook(book);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Presta Questo Libro</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
