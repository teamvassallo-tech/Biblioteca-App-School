import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { Book } from '../../types';
import { X, Printer, Barcode } from 'lucide-react';

interface LabelPrinterProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  schoolName?: string;
  autoPrint?: boolean;
}

export const ThermalLabelContent: React.FC<{
  book: Book;
  headerText: string;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  idPrefix: string;
}> = ({ book, headerText, svgRef, idPrefix }) => {
  const internalRef = useRef<SVGSVGElement | null>(null);
  const targetRef = svgRef || internalRef;
  const barcodeValue = (book.inventoryCode || book.isbn || 'LIB-0001').trim();
  const authorsText = (book.authors || []).join(', ') || 'Autore n/d';
  const collocazioneText = (book.collocazione || '').trim() || 'Biblioteca';
  const genreText = (book.genre || '').trim() || 'Libro';

  useEffect(() => {
    if (targetRef.current && barcodeValue) {
      try {
        JsBarcode(targetRef.current, barcodeValue, {
          format: 'CODE128',
          lineColor: '#000000',
          background: '#ffffff',
          width: 1.5,
          height: 26,
          margin: 0,
          displayValue: false,
        });
        targetRef.current.setAttribute('preserveAspectRatio', 'none');
      } catch (err) {
        console.error(`[LabelPrinter:${idPrefix}] Errore generazione barcode:`, err);
      }
    }
  }, [barcodeValue, targetRef, idPrefix]);

  return (
    <div
      className="thermal-label-print"
      style={{
        width: '51mm',
        maxWidth: '51mm',
        height: '25.5mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.5mm 2mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
    >
      {/* Intestazione 6pt bold + Codice Inventario */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2mm',
          fontSize: '6pt',
          fontWeight: 700,
          lineHeight: 1.1,
          textTransform: 'uppercase',
          color: '#000000',
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {headerText}
        </span>
        <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {barcodeValue}
        </span>
      </div>

      {/* Titolo 7.5pt bold su una riga + Autore 6.5pt */}
      <div style={{ width: '100%', color: '#000000', lineHeight: 1.15 }}>
        <div
          style={{
            fontSize: '7.5pt',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            color: '#000000',
          }}
        >
          {book.title}
        </div>
        <div
          style={{
            fontSize: '6.5pt',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
            color: '#000000',
          }}
        >
          {authorsText}
        </div>
      </div>

      {/* Barcode SVG CODE128: 42mm x 7mm */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <svg
          ref={targetRef}
          style={{
            width: '42mm',
            height: '7mm',
            display: 'block',
            margin: '0 auto',
            padding: 0,
          }}
        />
      </div>

      {/* Riga inferiore: Collocazione + Genere 6pt su tutta la larghezza */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2mm',
          fontSize: '6pt',
          fontWeight: 600,
          lineHeight: 1.1,
          color: '#000000',
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {collocazioneText}
        </span>
        <span
          style={{
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {genreText}
        </span>
      </div>
    </div>
  );
};

export const LabelPrinter: React.FC<LabelPrinterProps> = ({
  book,
  isOpen,
  onClose,
  schoolName,
  autoPrint = true,
}) => {
  const previewSvgRef = useRef<SVGSVGElement | null>(null);
  const printSvgRef = useRef<SVGSVGElement | null>(null);

  const headerText = schoolName?.trim()
    ? schoolName.trim().toUpperCase()
    : 'BIBLIOTECA SCOLASTICA';

  // Render strictly ONLY the selected single book ([book]) in the print portal
  const singleBookToPrint: Book[] = [book];

  // Ensure portal mount exists for isolated 51x26mm print output
  const getPortalContainer = (): HTMLElement => {
    let el = document.getElementById('thermal-label-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'thermal-label-portal';
      el.className = 'hidden print:block';
      document.body.appendChild(el);
    }
    return el;
  };

  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('printing-thermal-label');

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (autoPrint) {
      timer = setTimeout(() => {
        window.print();
      }, 150);
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.classList.remove('printing-thermal-label');
    };
  }, [isOpen, autoPrint, book.id, book.inventoryCode]);

  if (!isOpen) return null;

  const portalContainer = getPortalContainer();

  const handleManualPrint = () => {
    window.print();
  };

  return (
    <>
      {/* Modal Anteprima Rapida (Nascosta in fase di stampa) */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs print:hidden"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Barcode className="w-4 h-4 text-indigo-400" />
              <div>
                <h3 className="font-bold text-sm">Stampa Etichetta Termica (51×26 mm)</h3>
                <p className="text-[11px] text-slate-300">Calibrata per Brother TD-2320D • 1 foglio singolo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Chiudi anteprima"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="text-xs text-slate-600 text-center">
              Anteprima orizzontale (<strong>51mm × 26mm</strong> • Bianco e Nero puro):
            </div>

            {/* Preview Frame */}
            <div className="flex items-center justify-center p-6 bg-slate-100 rounded-xl border border-dashed border-slate-300">
              <div className="shadow-md border border-slate-300 bg-white rounded-[2px] overflow-hidden">
                <ThermalLabelContent
                  book={book}
                  headerText={headerText}
                  svgRef={previewSvgRef}
                  idPrefix="preview"
                />
              </div>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-[11px] text-indigo-950 space-y-1">
              <div>
                <strong>Libro:</strong> {book.title}
              </div>
              <div>
                <strong>Cod. Inventario:</strong>{' '}
                <span className="font-mono font-bold">{book.inventoryCode}</span>
                {book.collocazione && (
                  <>
                    {' '}• <strong>Collocazione:</strong> {book.collocazione}
                  </>
                )}
              </div>
              <div className="text-[10px] text-indigo-700 pt-0.5">
                Suggerimento stampa: seleziona formato carta <strong>51×26 mm</strong> e margini <strong>Nessuno</strong> nella finestra Brother TD-2320D.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={handleManualPrint}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Stampa Etichetta (51x26)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Hidden Print Portal rendering strictly ONLY [selectedBook] (1 page) */}
      {createPortal(
        <>
          {singleBookToPrint.map((selectedBook) => (
            <ThermalLabelContent
              key={selectedBook.id}
              book={selectedBook}
              headerText={headerText}
              svgRef={printSvgRef}
              idPrefix="print"
            />
          ))}
        </>,
        portalContainer
      )}
    </>
  );
};
