import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, AiRecommendation } from '../../types';
import { searchCatalogAi } from '../../services/onlineBookSearch';
import { BookCoverImage } from '../catalog/BookCoverImage';
import {
  Sparkles,
  Search,
  BookOpen,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Lightbulb,
  ArrowLeftRight
} from 'lucide-react';

interface AiSearchAssistantProps {
  onLoanBook?: (book: Book) => void;
  onViewBookDetail?: (book: Book) => void;
}

const SAMPLE_PROMPTS = [
  'Libri illustrati sugli animali e la natura per classe 2ª primaria',
  'Un racconto d\'avventura o mistero non troppo lungo per ragazzi di 11-12 anni',
  'Libri sull\'amicizia, l\'inclusione e il rispetto delle diversità',
  'Un romanzo fantasy coinvolgente con magia e creature leggendarie',
  'Storie divertenti e umoristiche per chi legge malvolentieri',
  'Racconti storici o mitologici per la scuola secondaria di primo grado'
];

export const AiSearchAssistant: React.FC<AiSearchAssistantProps> = ({
  onLoanBook,
  onViewBookDetail,
}) => {
  const { books, triggerScanFeedback } = useLibrary();

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generalAdvice, setGeneralAdvice] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (queryText?: string) => {
    const textToSearch = (queryText !== undefined ? queryText : query).trim();
    if (!textToSearch) {
      triggerScanFeedback('error', 'Scrivi una richiesta di lettura per l\'assistente AI.');
      return;
    }

    if (books.length === 0) {
      triggerScanFeedback('info', 'Il catalogo della biblioteca è vuoto. Aggiungi prima dei libri!');
      setGeneralAdvice(
        'Attualmente il catalogo della biblioteca è completamente vuoto. Catalogate i primi libri via ISBN o scanner per consentire all\'intelligenza artificiale di cercare tra i vostri volumi reali!'
      );
      setRecommendations([]);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setGeneralAdvice(null);
    setRecommendations([]);

    try {
      console.info(`[AiSearchAssistant] Ricerca semantica per query: "${textToSearch}"...`);
      const data = await searchCatalogAi(textToSearch, books);

      if (data.success) {
        setGeneralAdvice(data.generalAdvice || null);
        setRecommendations(data.recommendations || []);
        triggerScanFeedback('success', 'Consigli di lettura personalizzati generati dall\'AI!');
      } else {
        setGeneralAdvice(data.error || 'Nessun risultato disponibile.');
      }
    } catch (err: any) {
      console.error('[AiSearchAssistant] ERRORE DETTAGLIATO RICERCA SEMANTICA AI:', {
        query: textToSearch,
        errorMessage: err?.message || String(err),
        stack: err?.stack,
        error: err,
      });
      triggerScanFeedback('error', 'Errore durante la ricerca AI.');
      setGeneralAdvice('Si è verificato un errore durante la ricerca semantica. Consulta la console del browser per i dettagli.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-700/50 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-amber-300 border border-indigo-400/30 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Assistente Bibliotecario Intelligente con Gemini</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Consigli di Lettura in Linguaggio Naturale
          </h2>
          <p className="text-sm text-indigo-100 mt-2 leading-relaxed">
            Docenti e alunni possono esprimere desideri, temi didattici, fasce d&apos;età o livelli di lettura.
            L&apos;AI seleziona e consiglia <strong>esclusivamente tra i libri fisicamente presenti</strong> nella biblioteca scolastica.
          </p>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="mt-6 flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Es. Vorrei un libro avvincente sugli animali per una classe seconda primaria..."
                className="w-full pl-11 pr-4 py-3.5 text-sm sm:text-base bg-white text-slate-900 placeholder-slate-400 rounded-2xl border-2 border-indigo-400/60 focus:outline-none focus:ring-4 focus:ring-indigo-400/30 font-medium shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 rounded-2xl text-sm sm:text-base font-extrabold shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 transition shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Ricerca in corso...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Trova Libri</span>
                </>
              )}
            </button>
          </form>

          {/* Prompt Suggestions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-indigo-200 font-semibold flex items-center gap-1 mr-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
              Idee:
            </span>
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQuery(prompt);
                  handleSearch(prompt);
                }}
                className="text-xs bg-indigo-950/60 hover:bg-indigo-950 text-indigo-100 hover:text-white px-3 py-1 rounded-full border border-indigo-500/30 transition"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Area */}
      {hasSearched && (
        <div className="space-y-6">
          {/* General Pedagogic Advice from AI */}
          {generalAdvice && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-indigo-100 shadow-xs flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Consiglio del Bibliotecario Virtuale
                </h4>
                <p className="text-sm text-slate-700 leading-relaxed italic">
                  &ldquo;{generalAdvice}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Recommended Books List */}
          {recommendations.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                <span>Libri selezionati dal tuo catalogo</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  {recommendations.length} corrispondenze
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.map((rec) => {
                  const book = books.find((b) => b.id === rec.bookId);
                  if (!book) return null;

                  const isAvailable = book.copiesAvailable > 0;

                  return (
                    <div
                      key={book.id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex gap-4">
                          {/* Cover */}
                          <div className="w-20 h-28 bg-slate-900 rounded-xl overflow-hidden shadow-xs shrink-0 flex items-center justify-center">
                            <BookCoverImage
                              coverUrl={book.coverUrl}
                              title={book.title}
                              authors={book.authors}
                              genre={book.genre}
                              isbn={book.isbn}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                {book.genre}
                              </span>
                              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                {rec.matchScore}% affinità
                              </span>
                            </div>

                            <h4 className="font-extrabold text-slate-900 text-base leading-snug mt-1.5 line-clamp-1">
                              {book.title}
                            </h4>
                            <p className="text-xs text-slate-600 font-medium">
                              {(book.authors || []).join(', ')}
                            </p>

                            <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-semibold text-slate-700">{book.collocazione}</span>
                            </div>
                          </div>
                        </div>

                        {/* AI Pedagogic Reasoning */}
                        <div className="mt-3.5 p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-950 leading-relaxed">
                          <strong className="text-purple-700 font-semibold block mb-0.5">
                            Perché è consigliato:
                          </strong>
                          {rec.reasoning}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          {isAvailable ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Disponibile ({book.copiesAvailable} copie)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                              <Clock className="w-3.5 h-3.5" />
                              Attualmente in prestito
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {onViewBookDetail && (
                            <button
                              onClick={() => onViewBookDetail(book)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                            >
                              Scheda
                            </button>
                          )}
                          {isAvailable && onLoanBook && (
                            <button
                              onClick={() => onLoanBook(book)}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              <span>Presta</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !isLoading && (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm border border-slate-200">
                Nessun libro del catalogo attuale corrisponde in modo significativo a questa ricerca.
                Puoi provare a descrivere la richiesta con termini più generici o arricchire il catalogo!
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
