import React, { useState } from 'react';
import { Book } from '../../types';
import { generateBarcodeSvg } from '../../utils/barcode';
import { X, Printer, CheckSquare, Square } from 'lucide-react';

interface PrintBarcodesModalProps {
  books: Book[];
  isOpen: boolean;
  onClose: () => void;
}

export const PrintBarcodesModal: React.FC<PrintBarcodesModalProps> = ({
  books,
  isOpen,
  onClose,
}) => {
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(
    new Set(books.map((b) => b.id))
  );

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedBookIds(new Set(books.map((b) => b.id)));
  };

  const deselectAll = () => {
    setSelectedBookIds(new Set());
  };

  const booksToPrint = books.filter((b) => selectedBookIds.has(b.id));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-bold text-lg">Stampa Etichette Barcode per Libri</h3>
            <p className="text-xs text-slate-300">
              Etichette adesive con codice a barre Code-128 per dorso libro, leggibili da lettore USB
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Toolbar (hidden during print) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              Seleziona Tutti ({books.length})
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              Deseleziona
            </button>
            <span className="text-xs text-slate-500 ml-2">
              Selezionati: <strong>{booksToPrint.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={booksToPrint.length === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 transition shadow-md shadow-indigo-600/20"
            >
              <Printer className="w-4 h-4" />
              <span>Avvia Stampa Etichette</span>
            </button>
          </div>
        </div>

        {/* Printable Labels Grid */}
        <div className="p-6 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {booksToPrint.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Nessun libro selezionato per la stampa.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
              {booksToPrint.map((book) => {
                const codeToEncode = book.inventoryCode || book.isbn || 'LIB-0000';
                const barcodeSvg = generateBarcodeSvg(codeToEncode, {
                  height: 40,
                  barWidth: 1.4,
                  includeText: true,
                });

                return (
                  <div
                    key={book.id}
                    onClick={() => toggleSelect(book.id)}
                    className="cursor-pointer p-3.5 border border-slate-300 rounded-xl bg-white shadow-xs hover:border-indigo-400 transition flex flex-col justify-between print:border-slate-400 print:shadow-none print:rounded-md print:p-2"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-700 truncate">
                        Biblioteca Scolastica
                      </div>
                      <div className="font-bold text-xs text-slate-900 line-clamp-1 leading-snug">
                        {book.title}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {(book.authors || []).join(', ')}
                      </div>
                    </div>

                    {/* Barcode render */}
                    <div
                      className="my-2 flex justify-center"
                      dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                    />

                    <div className="text-[9px] text-slate-500 flex justify-between items-center border-t border-slate-100 pt-1">
                      <span className="truncate">{book.collocazione}</span>
                      <span className="font-mono font-bold text-slate-700">{book.genre}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
