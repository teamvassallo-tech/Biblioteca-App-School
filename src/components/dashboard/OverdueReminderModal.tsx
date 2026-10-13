import React, { useState } from 'react';
import { Loan, AppSettings } from '../../types';
import { X, Printer, Copy, Check, AlertTriangle, School } from 'lucide-react';

interface OverdueReminderModalProps {
  loan: Loan;
  settings: AppSettings;
  onClose: () => void;
}

export const OverdueReminderModal: React.FC<OverdueReminderModalProps> = ({
  loan,
  settings,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const todayStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const dueDateFormatted = new Date(loan.dueDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const reminderText = `AVVISO DI RESTITUZIONE LIBRO - BIBLIOTECA SCOLASTICA
${settings.schoolName || 'Istituto Scolastico'} - ${settings.libraryName}
Data: ${todayStr}

Gentile famiglia dell'alunno/a: ${loan.studentName}
Classe / Sezione: ${loan.studentClass}
Codice Tessera: ${loan.studentCode}

Vi ricordiamo che il seguente volume preso in prestito dalla biblioteca scolastica risulta SCADUTO:

Titolo: "${loan.bookTitle}"
Codice Inventario: ${loan.bookInventoryCode}
Data di Scadenza prevista: ${dueDateFormatted}

Vi preghiamo cortesemente di verificare che il libro venga riportato a scuola al più presto per consentire agli altri compagni e studenti di poterlo leggere.

In caso di smarrimento o danneggiamento, siete pregati di contattare i docenti responsabili della biblioteca scolastica.

Grazie per la consueta e preziosa collaborazione.
Il Responsabile della Biblioteca Scolastica`;

  const handleCopy = () => {
    navigator.clipboard.writeText(reminderText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-fadeIn">
        {/* Header */}
        <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-800 text-rose-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Sollecito di Restituzione</h3>
              <p className="text-xs text-rose-200">
                Avviso per l&apos;alunno/a {loan.studentName} ({loan.studentClass})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable card preview */}
        <div className="p-6">
          <div className="p-5 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 font-serif text-slate-800 text-xs sm:text-sm leading-relaxed space-y-3 print:border-none print:p-0">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <School className="w-5 h-5 text-indigo-700" />
              <div>
                <div className="font-bold text-slate-900 font-sans text-xs uppercase">
                  {settings.schoolName || 'Istituto Scolastico'}
                </div>
                <div className="text-[11px] text-slate-500 font-sans">{settings.libraryName}</div>
              </div>
            </div>

            <div className="font-sans text-xs text-slate-500">Data: {todayStr}</div>

            <p>
              Gentile famiglia dell&apos;alunno/a{' '}
              <strong className="text-slate-950 font-sans">
                {loan.studentName} (Classe {loan.studentClass})
              </strong>
              ,
            </p>

            <p>
              Vi segnaliamo che il prestito del seguente libro della biblioteca scolastica risulta in
              ritardo di riconsegna:
            </p>

            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 font-sans my-2">
              <div className="font-bold text-slate-900 text-sm">{loan.bookTitle}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Codice: {loan.bookInventoryCode} • Scaduto il:{' '}
                <strong className="text-rose-700">{dueDateFormatted}</strong>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Vi invitiamo a far riconsegnare il libro in biblioteca nei prossimi giorni per
              consentire agli altri studenti di prenderlo in prestito.
            </p>

            <div className="text-right pt-2 text-xs font-sans text-slate-500">
              Il Responsabile della Biblioteca Scolastica
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-100 mt-5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiato negli appunti!' : 'Copia Testo Avviso'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Avviso</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
