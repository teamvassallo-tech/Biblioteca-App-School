import React, { useState, useRef, useEffect } from 'react';
import { useLibrary } from '../context/LibraryContext';
import {
  Barcode,
  ArrowRight,
  RotateCcw,
  BookMarked,
  CheckCircle2,
  X,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { Book, Student } from '../types';
import { BookCoverImage } from './catalog/BookCoverImage';

interface ScanAndGoBarProps {
  onOpenNewLoanModal?: () => void;
  onOpenNewBookModal?: () => void;
}

export const ScanAndGoBar: React.FC<ScanAndGoBarProps> = ({
  onOpenNewLoanModal,
  onOpenNewBookModal,
}) => {
  const {
    findBookByCode,
    findStudentByCodeOrName,
    returnLoanByBookCode,
    createLoan,
    triggerScanFeedback,
  } = useLibrary();

  const [mode, setMode] = useState<'return' | 'loan'>('return');
  const [scanInput, setScanInput] = useState('');
  // In loan mode: staged book waiting for student scan
  const [stagedBook, setStagedBook] = useState<Book | null>(null);
  const [stagedStudent, setStagedStudent] = useState<Student | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep autofocus active ready for USB scanner
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, stagedBook]);

  // Handle USB scanner input upon "Enter"
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = scanInput.trim();
    if (!rawCode) return;

    if (mode === 'return') {
      // Rapid return mode: Scan book barcode -> Return book immediately
      const result = returnLoanByBookCode(rawCode);
      setScanInput('');
      // Refocus input
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Rapid loan mode:
    if (!stagedBook) {
      // Step 1: Scan book
      const book = findBookByCode(rawCode);
      if (!book) {
        triggerScanFeedback('error', `Nessun libro trovato con codice/ISBN: "${rawCode}"`);
        setScanInput('');
        return;
      }

      if (book.copiesAvailable <= 0) {
        triggerScanFeedback('error', `Il libro "${book.title}" non ha copie disponibili.`);
        setScanInput('');
        return;
      }

      setStagedBook(book);
      triggerScanFeedback('info', `Libro selezionato: "${book.title}". Ora scansiona la tessera alunno o cerca l'alunno.`);
      setScanInput('');
    } else {
      // Step 2: Scan student barcode or search student
      const student = findStudentByCodeOrName(rawCode);
      if (!student) {
        triggerScanFeedback('error', `Nessun alunno trovato con codice o nome: "${rawCode}".`);
        setScanInput('');
        return;
      }

      // Complete loan!
      const res = createLoan(stagedBook.id, student.id);
      if (res.success) {
        setStagedBook(null);
        setStagedStudent(null);
      }
      setScanInput('');
    }

    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCancelStaged = () => {
    setStagedBook(null);
    setStagedStudent(null);
    setScanInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-indigo-900/50 mb-8">
      {/* Header with Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span>Postazione Barcode Scan & Go</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Scanner USB Pronto
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              Scansiona con il lettore barcode USB o digita il codice e premi Invio
            </p>
          </div>
        </div>

        {/* Mode switcher pills */}
        <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => {
              setMode('return');
              handleCancelStaged();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'return'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restituzione Rapida</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('loan');
              handleCancelStaged();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              mode === 'loan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>Nuovo Prestito</span>
          </button>
        </div>
      </div>

      {/* Staged State for Prestito */}
      {mode === 'loan' && stagedBook && (
        <div className="mb-4 bg-indigo-900/40 border border-indigo-700/60 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-14 rounded shadow-xs overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
              <BookCoverImage
                coverUrl={stagedBook.coverUrl}
                title={stagedBook.title}
                authors={stagedBook.authors}
                genre={stagedBook.genre}
                isbn={stagedBook.isbn}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
                Passo 2: Scansiona Tessera Alunno per assegnare
              </div>
              <div className="text-sm font-bold text-white leading-tight">{stagedBook.title}</div>
              <div className="text-xs text-slate-300">
                Codice: {stagedBook.inventoryCode} • Scaffale: {stagedBook.collocazione}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelStaged}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 p-1 rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" /> Annulla
          </button>
        </div>
      )}

      {/* Scanner Input Form */}
      <form onSubmit={handleScanSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400 pointer-events-none">
            {mode === 'return' ? (
              <RotateCcw className="w-5 h-5 text-rose-400" />
            ) : stagedBook ? (
              <UserCheck className="w-5 h-5 text-indigo-400" />
            ) : (
              <BookMarked className="w-5 h-5 text-indigo-400" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder={
              mode === 'return'
                ? '⚡ Restituzione immediata: Scansiona il barcode o ISBN del libro...'
                : stagedBook
                ? `⚡ Scansiona codice alunno (es. ALU-0001) o digita Nome e Cognome per "${stagedBook.title}"...`
                : '⚡ Nuovo prestito: Scansiona il barcode o ISBN del libro da prestare...'
            }
            className="w-full bg-slate-950/80 text-white placeholder-slate-400 text-sm sm:text-base font-medium pl-12 pr-28 py-3.5 rounded-xl border border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition shadow-inner"
            autoFocus
          />

          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="submit"
              disabled={!scanInput.trim()}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
                mode === 'return'
                  ? 'bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white'
              }`}
            >
              <span>{mode === 'return' ? 'Restituisci' : stagedBook ? 'Assegna' : 'Seleziona'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>

      {/* Helpful shortcut tips */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
            Invio
          </span>
          <span>Esegue istantaneamente senza clic del mouse</span>
        </div>

        <div className="flex items-center gap-3">
          {onOpenNewLoanModal && (
            <button
              type="button"
              onClick={onOpenNewLoanModal}
              className="text-indigo-300 hover:text-white underline underline-offset-2 flex items-center gap-1"
            >
              <span>Prestito con selezione guidata</span>
            </button>
          )}
          {onOpenNewBookModal && (
            <button
              type="button"
              onClick={onOpenNewBookModal}
              className="text-indigo-300 hover:text-white underline underline-offset-2 flex items-center gap-1"
            >
              <span>+ Cataloga nuovo libro</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
