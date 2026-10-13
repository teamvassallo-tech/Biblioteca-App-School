import React, { useState, useRef } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import {
  exportAllToJson,
  exportBooksToCsv,
  exportLoansToCsv,
  exportStudentsToCsv,
  parseCsv,
} from '../../utils/exportImport';
import { Book, Student } from '../../types';
import { generateBookCoverDataUrl } from '../../utils/coverGenerator';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileJson,
  Volume2,
  VolumeX,
  ShieldAlert,
  Building,
  Calendar,
  X,
  Database,
  Globe,
  Sparkles,
  RefreshCw,
  Key,
  Image as ImageIcon,
  Loader2,
  Palette
} from 'lucide-react';
import { VisualLayoutSettings } from './VisualLayoutSettings';

export const SettingsAndData: React.FC = () => {
  const {
    books,
    students,
    loans,
    settings,
    updateSettings,
    updateBook,
    resetTotalSystem,
    restoreDataPackage,
    triggerScanFeedback,
  } = useLibrary();

  // General Settings State
  const [libraryName, setLibraryName] = useState(settings.libraryName);
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [defaultDuration, setDefaultDuration] = useState(settings.defaultLoanDurationDays);

  // External Bibliographic Database Credentials State
  const [isbndbKey, setIsbndbKey] = useState(settings.isbndbApiKey || '');
  const [worldcatKey, setWorldcatKey] = useState(settings.worldcatWskey || '');
  const [librarythingKey, setLibrarythingKey] = useState(settings.librarythingDevKey || '');

  // Batch Cover Recovery State
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; fixed: number } | null>(null);

  // Reset Security Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      libraryName: libraryName.trim(),
      schoolName: schoolName.trim(),
      defaultLoanDurationDays: Number(defaultDuration) || 30,
      isbndbApiKey: isbndbKey.trim() || undefined,
      worldcatWskey: worldcatKey.trim() || undefined,
      librarythingDevKey: librarythingKey.trim() || undefined,
    });
    triggerScanFeedback('success', 'Impostazioni generali e banche dati salvate con successo!');
  };

  // Batch Cover Recovery for Entire Catalog (solves missing covers on existing books)
  const handleBatchCoverRecovery = async () => {
    if (books.length === 0) {
      triggerScanFeedback('info', 'Nessun libro presente nel catalogo da analizzare.');
      return;
    }

    setIsBatchRunning(true);
    let updatedCount = 0;
    setBatchProgress({ current: 0, total: books.length, fixed: 0 });

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      setBatchProgress({ current: i + 1, total: books.length, fixed: updatedCount });

      // If book has no cover or blank/broken cover
      const hasValidCover =
        book.coverUrl &&
        book.coverUrl.trim().length > 0 &&
        !book.coverUrl.includes('covers.librarything.com');
      if (!hasValidCover) {
        let resolvedCover = '';
        const cleanIsbn = (book.isbn || '').replace(/[^0-9X]/gi, '');

        if (cleanIsbn.length >= 10) {
          try {
            const res = await fetch(`/api/cover-lookup/${encodeURIComponent(cleanIsbn)}`);
            const data = await res.json();
            if (data.found && data.coverUrl) {
              resolvedCover = data.coverUrl;
            }
          } catch {}
        }

        // If no online cover found, generate guaranteed high-res SVG
        if (!resolvedCover) {
          resolvedCover = generateBookCoverDataUrl(
            book.title,
            (book.authors || []).join(', '),
            book.genre,
            settings.schoolName
          );
        }

        updateBook(book.id, { coverUrl: resolvedCover });
        updatedCount++;
      }
    }

    setIsBatchRunning(false);
    setBatchProgress(null);
    triggerScanFeedback(
      'success',
      updatedCount > 0
        ? `Operazione completata! Aggiornate con successo ${updatedCount} copertine nel catalogo!`
        : 'Tutti i libri del catalogo dispongono già di una copertina attiva!'
    );
  };

  // Export handlers
  const handleExportJson = () => {
    exportAllToJson(books, students, loans, settings);
    triggerScanFeedback('success', 'Backup completo JSON scaricato!');
  };

  const handleExportBooksCsv = () => {
    exportBooksToCsv(books);
    triggerScanFeedback('success', 'Catalogo Libri CSV scaricato (compatibile con Excel/Google Fogli)!');
  };

  const handleExportLoansCsv = () => {
    exportLoansToCsv(loans);
    triggerScanFeedback('success', 'Registro Prestiti CSV scaricato!');
  };

  const handleExportStudentsCsv = () => {
    exportStudentsToCsv(students);
    triggerScanFeedback('success', 'Anagrafica Alunni CSV scaricata!');
  };

  // Import handler
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;

        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (parsed && (parsed.books || parsed.students || parsed.loans)) {
            restoreDataPackage(parsed, true);
            setImportStatus('Backup JSON ripristinato con successo!');
          } else {
            triggerScanFeedback('error', 'Formato JSON non riconosciuto.');
          }
        } else if (file.name.endsWith('.csv')) {
          const rows = parseCsv(content);
          if (rows.length < 2) {
            triggerScanFeedback('error', 'Il file CSV selezionato è vuoto o non contiene dati.');
            return;
          }

          const headerRow = rows[0].map((h) => h.toLowerCase());

          // Detect whether this is a Books CSV or Students CSV
          if (headerRow.some((h) => h.includes('titolo') || h.includes('inventario') || h.includes('isbn'))) {
            // Books CSV import
            const titleIdx = headerRow.findIndex((h) => h.includes('titolo'));
            const invIdx = headerRow.findIndex((h) => h.includes('inventario') || h.includes('codice'));
            const authorIdx = headerRow.findIndex((h) => h.includes('autore'));
            const isbnIdx = headerRow.findIndex((h) => h.includes('isbn'));
            const collocazioneIdx = headerRow.findIndex((h) => h.includes('collocazione') || h.includes('scaffale'));
            const genreIdx = headerRow.findIndex((h) => h.includes('genere'));

            const importedBooks: Book[] = [];
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (!row[titleIdx]) continue;

              importedBooks.push({
                id: `lib_imp_${Date.now()}_${i}`,
                title: row[titleIdx],
                inventoryCode: (invIdx !== -1 && row[invIdx]) ? row[invIdx] : `LIB-${String(books.length + i).padStart(4, '0')}`,
                isbn: (isbnIdx !== -1 && row[isbnIdx]) ? row[isbnIdx] : undefined,
                authors: (authorIdx !== -1 && row[authorIdx]) ? row[authorIdx].split(';').map((a) => a.trim()) : ['Autore sconosciuto'],
                genre: (genreIdx !== -1 && row[genreIdx]) ? row[genreIdx] : 'Narrativa',
                ageGroup: 'Primaria (8-11 anni)',
                collocazione: (collocazioneIdx !== -1 && row[collocazioneIdx]) ? row[collocazioneIdx] : 'Scaffale Generale',
                copiesTotal: 1,
                copiesAvailable: 1,
                status: 'Disponibile',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            restoreDataPackage({ books: importedBooks }, false);
            setImportStatus(`Importati ${importedBooks.length} libri dal file CSV!`);
          } else if (headerRow.some((h) => h.includes('cognome') || h.includes('alunno') || h.includes('classe'))) {
            // Students CSV import
            const firstIdx = headerRow.findIndex((h) => h.includes('nome') && !h.includes('cognome'));
            const lastIdx = headerRow.findIndex((h) => h.includes('cognome'));
            const classIdx = headerRow.findIndex((h) => h.includes('classe') || h.includes('sezione'));

            const importedStudents: Student[] = [];
            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const fName = firstIdx !== -1 ? row[firstIdx] : 'Alunno';
              const lName = lastIdx !== -1 ? row[lastIdx] : `Studente ${i}`;
              if (!fName && !lName) continue;

              importedStudents.push({
                id: `stu_imp_${Date.now()}_${i}`,
                studentCode: `ALU-${String(students.length + i).padStart(4, '0')}`,
                firstName: fName,
                lastName: lName,
                classSection: (classIdx !== -1 && row[classIdx]) ? row[classIdx] : '1A',
                schoolLevel: 'Primaria',
                createdAt: new Date().toISOString(),
              });
            }

            restoreDataPackage({ students: importedStudents }, false);
            setImportStatus(`Importati ${importedStudents.length} alunni dal file CSV!`);
          } else {
            triggerScanFeedback('error', 'Struttura CSV non riconosciuta. Assicurati che contenga colonne per Libri o Alunni.');
          }
        }
      } catch (err: any) {
        console.error(err);
        triggerScanFeedback('error', 'Errore durante la lettura del file di importazione.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Critical System Reset Confirmation
  const handleConfirmTotalReset = () => {
    if (confirmDeleteText.trim().toUpperCase() !== 'CANCELLA') {
      triggerScanFeedback('error', 'Parola chiave di sicurezza non corretta. Digita "CANCELLA".');
      return;
    }

    resetTotalSystem();
    setIsResetModalOpen(false);
    setConfirmDeleteText('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. General Settings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Configurazione Biblioteca</h3>
            <p className="text-xs text-slate-500">
              Personalizza le intestazioni delle schede, tessere alunni e durata prestiti
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-400" />
                Nome Biblioteca Scolastica
              </label>
              <input
                type="text"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Es. Biblioteca 'Il Libro Magico'"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nome Istituto Scolastico
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Es. I.C. Giovanni Falcone"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Durata Predefinita del Prestito (in giorni)
              </label>
              <input
                type="number"
                min={7}
                max={180}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl font-bold"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Standard consigliato per le scuole: 30 giorni.
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition self-start"
              >
                Salva Impostazioni
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 2. Visual Layout & Presets */}
      <VisualLayoutSettings />

      {/* 3. Bibliographic Databases & Cover Management */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Banche Dati Bibliografiche &amp; Copertine</h3>
              <p className="text-xs text-slate-500">
                Integrazione multi-fonte per ricerca metadati, deposito legale BNI, copertine ad alta definizione
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            8 Fonti Collegate
          </span>
        </div>

        {/* Database Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* BNI */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🏛️</span> BNI (BNCF Firenze)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Attivo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                <strong>Bibliografia Nazionale Italiana</strong>: pubblicata dalla Biblioteca Nazionale Centrale di Firenze per il deposito legale di ogni pubblicazione in Italia.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 mt-2 block">
              ✓ Ufficiale Deposito Legale Italiano
            </span>
          </div>

          {/* OPAC SBN */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🇮🇹</span> OPAC SBN (ICCU)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Attivo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Catalogo collettivo nazionale delle biblioteche italiane. Fornisce codici ICCU, collocazioni e autori normalizzati.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-indigo-700 mt-2 block">
              ✓ Catalogo Ufficiale dello Stato
            </span>
          </div>

          {/* LibraryThing ThingISBN */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>📚</span> LibraryThing (ThingISBN)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Attivo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Ottimo per associare edizioni diverse dello stesso testo (hardcover, tascabile, traduzione) e reperire copertine.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-amber-700 mt-2 block">
              ✓ Motore Copertine &amp; Cross-Edition
            </span>
          </div>

          {/* WorldCat OCLC */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🌐</span> WorldCat / OCLC
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${worldcatKey ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {worldcatKey ? 'Con Chiave' : 'Disponibile'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Il più grande database bibliografico mondiale. Supporta convenzioni o credenziali istituzionali della scuola/università.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-blue-700 mt-2 block">
              ✓ Database Mondiale Globale
            </span>
          </div>

          {/* ISBNdb */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>⭐</span> ISBNdb (30M+ Libri)
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isbndbKey ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {isbndbKey ? 'Con Chiave' : 'Disponibile'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Database commerciale mondiale con oltre 30 milioni di libri (molto accurato, richiede abbonamento con chiave API).
              </p>
            </div>
            <span className="text-[10px] font-semibold text-purple-700 mt-2 block">
              ✓ Schede Complete &amp; Immagini HQ
            </span>
          </div>

          {/* Crossref */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <span>🎓</span> Crossref Accademico
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Attivo
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Specifico per pubblicazioni accademiche, saggi, riviste e testi universitari con codici DOI/ISBN.
              </p>
            </div>
            <span className="text-[10px] font-semibold text-cyan-700 mt-2 block">
              ✓ Saggistica &amp; Editoria Accademica
            </span>
          </div>
        </div>

        {/* API Credentials Configuration Panel */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Key className="w-4 h-4 text-indigo-600" />
            <span>Credenziali e Chiavi Istituzionali (Opzionali)</span>
          </div>
          <p className="text-xs text-slate-600">
            Se il tuo istituto scolastico possiede un abbonamento commerciale a <strong>ISBNdb</strong>, una convenzione istituzionale <strong>WorldCat / OCLC</strong>, o una chiave sviluppatore <strong>LibraryThing</strong>, puoi inserirle qui:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ISBNdb API Key</label>
              <input
                type="password"
                value={isbndbKey}
                onChange={(e) => setIsbndbKey(e.target.value)}
                placeholder="Es. 49302_xxxxxxx"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WorldCat / OCLC WSKey</label>
              <input
                type="password"
                value={worldcatKey}
                onChange={(e) => setWorldcatKey(e.target.value)}
                placeholder="Es. wskey_istituzionale..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LibraryThing DevKey</label>
              <input
                type="text"
                value={librarythingKey}
                onChange={(e) => setLibrarythingKey(e.target.value)}
                placeholder="Predefinito SBN attivo"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveGeneral}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Salva Chiavi Banche Dati
            </button>
          </div>
        </div>

        {/* Maintenance Tool: Batch Cover Recovery for Entire Catalog */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Recupero &amp; Aggiornamento Copertine per Tutto il Catalogo
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Scansiona tutti i volumi registrati (inclusi i primi libri inseriti). Se un libro non ha copertina, la interroga online su BNI/SBN, Open Library e LibraryThing o ne genera la copertina grafica scolastica ad alta definizione!
              </p>
              {batchProgress && (
                <div className="mt-2 text-xs font-semibold text-indigo-700 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Elaborazione in corso: {batchProgress.current} di {batchProgress.total} libri ({batchProgress.fixed} copertine aggiornate)...</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleBatchCoverRecovery}
            disabled={isBatchRunning || books.length === 0}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shrink-0 shadow-sm cursor-pointer"
          >
            {isBatchRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Elaborazione...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Recupera Copertine Mancanti</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Data Backup & Export (JSON & CSV Google Sheets / Excel) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Backup &amp; Esportazione Dati</h3>
            <p className="text-xs text-slate-500">
              Esporta il catalogo e i prestiti in formati aperti compatibili con Excel e Google Fogli
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* JSON Full Backup */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-1">
                <FileJson className="w-5 h-5" />
                <span>Backup Completo</span>
              </div>
              <p className="text-xs text-slate-600">
                Tutti i libri, studenti, prestiti e configurazioni in un unico file JSON.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="mt-4 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica JSON</span>
            </button>
          </div>

          {/* Books CSV */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Catalogo Libri (CSV)</span>
              </div>
              <p className="text-xs text-slate-600">
                Esporta i {books.length} volumi a catalogo con collocazione, ISBN e copie per Excel.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportBooksCsv}
              className="mt-4 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Libri CSV</span>
            </button>
          </div>

          {/* Loans CSV */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Registro Prestiti (CSV)</span>
              </div>
              <p className="text-xs text-slate-600">
                Storico completo di tutti i {loans.length} prestiti, scadenze e restituzioni.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportLoansCsv}
              className="mt-4 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Prestiti CSV</span>
            </button>
          </div>

          {/* Students CSV */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Anagrafica Alunni (CSV)</span>
              </div>
              <p className="text-xs text-slate-600">
                Elenco dei {students.length} lettori registrati con codice tessera e classe.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportStudentsCsv}
              className="mt-4 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Alunni CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Data Import */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Importazione Dati</h3>
            <p className="text-xs text-slate-500">
              Ripristina un backup JSON precedente o importa elenchi di libri/alunni da file CSV
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv"
            onChange={handleFileImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition"
          >
            <Upload className="w-4 h-4" />
            <span>Seleziona File da Importare (.json o .csv)</span>
          </button>
          <span className="text-xs text-slate-500">
            Supporta backup completi (.json) ed elenchi da Excel (.csv).
          </span>
        </div>

        {importStatus && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* 4. CRITICAL REQUIREMENT: Reset Totale Sistema */}
      <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-rose-950">
              Zona di Pericolo: Reset Totale Sistema
            </h3>
            <p className="text-xs sm:text-sm text-rose-800 mt-1 leading-relaxed max-w-2xl">
              Questa azione cancellerà istantaneamente e in modo irreversibile{' '}
              <strong>tutti i libri a catalogo ({books.length})</strong>,{' '}
              <strong>tutti gli alunni ({students.length})</strong> e{' '}
              <strong>l&apos;intero registro prestiti ({loans.length})</strong>, riportando l&apos;applicazione
              allo stato vergine iniziale completamente vuoto.
            </p>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteText('');
                  setIsResetModalOpen(true);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Totale Sistema...</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security Confirmation Modal for Total Reset */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-300 overflow-hidden animate-fadeIn">
            <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-extrabold text-lg">Conferma Reset Totale</h3>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-rose-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Stai per azzerare completamente tutti gli archivi della biblioteca scolastica.
                Tutti i libri, gli alunni e i prestiti saranno rimossi per sempre dalla memoria locale.
              </p>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-medium">
                Per confermare l&apos;azzeramento totale, digita la parola{' '}
                <strong className="font-mono text-rose-700 font-extrabold">CANCELLA</strong> nel
                campo sottostante:
              </div>

              <div>
                <input
                  type="text"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder="Digita CANCELLA qui per sbloccare il pulsante"
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold text-rose-900 border-2 border-rose-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTotalReset}
                  disabled={confirmDeleteText.trim().toUpperCase() !== 'CANCELLA'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-rose-600/20 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Sì, Azzera Tutto Ora</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
