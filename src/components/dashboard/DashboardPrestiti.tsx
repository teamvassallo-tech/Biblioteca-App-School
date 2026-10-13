import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { ScanAndGoBar } from '../ScanAndGoBar';
import { NewLoanModal } from './NewLoanModal';
import { OverdueReminderModal } from './OverdueReminderModal';
import { Loan } from '../../types';
import {
  BookOpen,
  ArrowLeftRight,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  RotateCcw,
  CalendarPlus,
  FileText,
  Search,
  Plus,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface DashboardPrestitiProps {
  onOpenCatalog: () => void;
  onOpenAiSearch: () => void;
  onOpenAddBookModal: () => void;
}

export const DashboardPrestiti: React.FC<DashboardPrestitiProps> = ({
  onOpenCatalog,
  onOpenAiSearch,
  onOpenAddBookModal,
}) => {
  const { books, students, loans, returnLoan, renewLoan, settings } = useLibrary();

  const [filterTab, setFilterTab] = useState<'attivi' | 'ritardo' | 'restituiti' | 'tutti'>('attivi');
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [reminderLoan, setReminderLoan] = useState<Loan | null>(null);

  // Statistics calculation
  const totalBooks = books.length;
  const activeLoans = loans.filter((l) => l.status === 'Attivo' || l.status === 'In Ritardo');
  const overdueLoans = loans.filter((l) => l.status === 'In Ritardo');
  const returnedLoans = loans.filter((l) => l.status === 'Restituito');

  const distinctBorrowersCount = new Set(activeLoans.map((l) => l.studentId)).size;

  // Filtered loans for table
  const filteredLoans = loans.filter((loan) => {
    // Tab filter
    if (filterTab === 'attivi' && loan.status === 'Restituito') return false;
    if (filterTab === 'ritardo' && loan.status !== 'In Ritardo') return false;
    if (filterTab === 'restituiti' && loan.status !== 'Restituito') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBook = loan.bookTitle.toLowerCase().includes(q) || loan.bookInventoryCode.toLowerCase().includes(q);
      const matchStudent =
        loan.studentName.toLowerCase().includes(q) ||
        loan.studentClass.toLowerCase().includes(q) ||
        loan.studentCode.toLowerCase().includes(q);
      return matchBook || matchStudent;
    }

    return true;
  });

  const getDaysDiff = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* 1. Barcode Scanner USB "Scan & Go" Hero Bar */}
      <ScanAndGoBar
        onOpenNewLoanModal={() => setIsNewLoanOpen(true)}
        onOpenNewBookModal={onOpenAddBookModal}
      />

      {/* 2. Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Libri a Catalogo */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Libri a Catalogo
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{totalBooks}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {books.filter((b) => b.copiesAvailable > 0).length} disponibili ora
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Prestiti Attivi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Prestiti in Corso
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 mt-1">{activeLoans.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              Su {students.length} alunni iscritti
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Prestiti in Ritardo (Bright Red Badge) */}
        <div
          className={`rounded-2xl p-5 border shadow-xs flex items-center justify-between transition ${
            overdueLoans.length > 0
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200/80'
          }`}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Prestiti in Ritardo
            </div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              {overdueLoans.length}
            </div>
            <div className="text-xs text-rose-700/80 mt-0.5 font-medium">
              {overdueLoans.length === 0 ? 'Nessun ritardo al momento' : 'Richiedono sollecito'}
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              overdueLoans.length > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Lettori Attivi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Studenti con Libri
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {distinctBorrowersCount}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {returnedLoans.length} restituzioni storiche
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Prestiti Registry Table / Dashboard */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-lg mr-2">Registro Prestiti</h3>
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFilterTab('attivi')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === 'attivi'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                In Corso ({activeLoans.length})
              </button>
              <button
                onClick={() => setFilterTab('ritardo')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${
                  filterTab === 'ritardo'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                <span>In Ritardo</span>
                {overdueLoans.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-700 text-white">
                    {overdueLoans.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilterTab('restituiti')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === 'restituiti'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Restituiti ({returnedLoans.length})
              </button>
              <button
                onClick={() => setFilterTab('tutti')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterTab === 'tutti'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutti ({loans.length})
              </button>
            </div>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca libro, alunno, classe..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => setIsNewLoanOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nuovo Prestito</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loans.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
              <ArrowLeftRight className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Nessun prestito registrato</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              L&apos;archivio prestiti è attualmente vuoto. Scansiona un codice a barre con il lettore USB
              nella barra in alto o clicca sul pulsante qui sotto per assegnare il tuo primo prestito.
            </p>
            <button
              onClick={() => setIsNewLoanOpen(true)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Registra Primo Prestito</span>
            </button>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nessun prestito corrisponde ai filtri impostati.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Libro</th>
                  <th className="py-3 px-4">Alunno &amp; Classe</th>
                  <th className="py-3 px-4">Data Prestito</th>
                  <th className="py-3 px-4">Scadenza</th>
                  <th className="py-3 px-4">Stato</th>
                  <th className="py-3 px-4 text-right">Azioni Rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.map((loan) => {
                  const daysDiff = getDaysDiff(loan.dueDate);
                  const isOverdue = loan.status === 'In Ritardo' || (loan.status === 'Attivo' && daysDiff < 0);
                  const isReturned = loan.status === 'Restituito';

                  return (
                    <tr
                      key={loan.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isOverdue ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Book Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {loan.bookCoverUrl ? (
                            <img
                              src={loan.bookCoverUrl}
                              alt={loan.bookTitle}
                              className="w-9 h-12 object-cover rounded shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-12 bg-indigo-50 border border-indigo-200 rounded flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                              LIB
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 leading-snug line-clamp-1">
                              {loan.bookTitle}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Cod: {loan.bookInventoryCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Student & Class */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{loan.studentName}</div>
                        <div className="text-[11px] text-slate-500">
                          Classe: <strong className="text-slate-700">{loan.studentClass}</strong> •{' '}
                          <span className="font-mono">{loan.studentCode}</span>
                        </div>
                      </td>

                      {/* Loan Date */}
                      <td className="py-3.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(loan.loanDate).toLocaleDateString('it-IT')}
                      </td>

                      {/* Due Date & Remaining days */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs">
                          {new Date(loan.dueDate).toLocaleDateString('it-IT')}
                        </div>
                        {!isReturned && (
                          <div
                            className={`text-[11px] font-bold ${
                              daysDiff < 0
                                ? 'text-rose-600'
                                : daysDiff <= 3
                                ? 'text-amber-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {daysDiff < 0
                              ? `Scaduto da ${Math.abs(daysDiff)} giorni!`
                              : daysDiff === 0
                              ? 'Scade oggi!'
                              : `Restano ${daysDiff} giorni`}
                          </div>
                        )}
                        {isReturned && loan.returnDate && (
                          <div className="text-[11px] text-emerald-600">
                            Restituito il {new Date(loan.returnDate).toLocaleDateString('it-IT')}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Restituito
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            IN RITARDO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                            <Clock className="w-3.5 h-3.5" />
                            In Corso
                          </span>
                        )}
                        {loan.renewalsCount > 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Prorogato {loan.renewalsCount}x
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isReturned ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => returnLoan(loan.id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              title="Registra restituzione del libro"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restituisci</span>
                            </button>

                            <button
                              onClick={() => renewLoan(loan.id, 15)}
                              className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                              title="Proroga di 15 giorni"
                            >
                              +15gg
                            </button>

                            {isOverdue && (
                              <button
                                onClick={() => setReminderLoan(loan)}
                                className="px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                title="Genera avviso di sollecito"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Sollecito</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Chiuso</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Quick Help Footer Banner for Teachers/Librarians */}
      <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Vuoi consigliare una lettura speciale ai tuoi alunni?
            </h4>
            <p className="text-xs text-slate-600">
              Usa l&apos;assistente intelligente AI per cercare tra i libri presenti a catalogo con
              richieste in linguaggio naturale.
            </p>
          </div>
        </div>
        <button
          onClick={onOpenAiSearch}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0"
        >
          <span>Prova Cerca con AI</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modals */}
      {isNewLoanOpen && (
        <NewLoanModal isOpen={isNewLoanOpen} onClose={() => setIsNewLoanOpen(false)} />
      )}

      {reminderLoan && (
        <OverdueReminderModal
          loan={reminderLoan}
          settings={settings}
          onClose={() => setReminderLoan(null)}
        />
      )}
    </div>
  );
};
