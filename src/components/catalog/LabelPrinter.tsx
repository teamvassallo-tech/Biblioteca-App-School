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

function truncateText(text: string, maxLen = 25): string {
  const clean = (text || '').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).trimEnd() + '…';
}

const ThermalLabelContent: React.FC<{
  book: Book;
  headerText: string;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  idPrefix: string;
}> = ({ book, headerText, svgRef, idPrefix }) => {
  const internalRef = useRef<SVGSVGElement | null>(null);
  const targetRef = svgRef || internalRef;
  const barcodeValue = (book.inventoryCode || book.isbn || 'LIB-0001').trim();
  const truncatedTitle = truncateText(book.title, 25);
  const collocazioneText = (book.collocazione || '').trim();

  useEffect(() => {
    if (targetRef.current && barcodeValue) {
      try {
        JsBarcode(targetRef.current, barcodeValue, {
          format: 'CODE128',
          lineColor: '#000000',
          background: '#ffffff',
          width: 1.5,
          height: 38,
          margin: 0,
          displayValue: false,
        });
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
        height: '26mm',
        boxSizing: 'border-box',
        padding: '1.5mm',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
    >
      {/* Intestazione compatta */}
      <div
        style={{
          fontSize: '6pt',
          fontWeight: 700,
          lineHeight: 1.1,
          textTransform: 'uppercase',
          letterSpacing: '0.2pt',
          textAlign: 'center',
          width: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#000000',
        }}
      >
        {headerText}
      </div>

      {/* Codice a barre SVG CODE128 (~10mm di altezza, zero margini inutili) */}
      <div
        style={{
          width: '100%',
          height: '10mm',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          margin: '0.4mm 0',
        }}
      >
        <svg
          ref={targetRef}
          style={{
            height: '10mm',
            maxWidth: '47mm',
            width: 'auto',
            display: 'block',
            margin: 0,
            padding: 0,
          }}
        />
      </div>

      {/* Testo leggibile sotto il barcode: Codice Inventario + Collocazione / Titolo troncato */}
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          lineHeight: 1.15,
          color: '#000000',
        }}
      >
        <div
          style={{
            fontSize: '7.5pt',
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.4pt',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {barcodeValue}
          {collocazioneText ? ` • ${truncateText(collocazioneText, 16)}` : ''}
        </div>
        <div
          style={{
            fontSize: '6pt',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {truncatedTitle}
        </div>
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
    ? truncateText(schoolName.trim().toUpperCase(), 32)
    : 'BIBLIOTECA SCOLASTICA';

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
                <p className="text-[11px] text-slate-300">Calibrata per Brother TD-2320D</p>
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
              Anteprima in scala reale (<strong>51mm × 26mm</strong> • Bianco e Nero puro):
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

      {/* Dedicated Hidden Print Portal rendered directly inside document.body */}
      {createPortal(
        <ThermalLabelContent
          book={book}
          headerText={headerText}
          svgRef={printSvgRef}
          idPrefix="print"
        />,
        portalContainer
      )}
    </>
  );
};
