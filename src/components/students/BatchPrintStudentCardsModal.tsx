import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Student } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import {
  CARD_THEMES,
  CardThemeId,
  generateStudentCardSvg,
} from '../../utils/studentCardRenderer';
import {
  X,
  Printer,
  CheckSquare,
  Square,
  Palette,
  Layers,
  Sparkles,
  Info,
  FileCode,
  ExternalLink
} from 'lucide-react';

interface BatchPrintStudentCardsModalProps {
  students: Student[];
  isOpen: boolean;
  onClose: () => void;
}

export const BatchPrintStudentCardsModal: React.FC<BatchPrintStudentCardsModalProps> = ({
  students,
  isOpen,
  onClose,
}) => {
  const { settings, triggerScanFeedback } = useLibrary();

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(students.map((s) => s.id))
  );
  const [selectedTheme, setSelectedTheme] = useState<CardThemeId>('navy');
  const [academicYear, setAcademicYear] = useState('A.S. 2025/2026');
  const [printLayout, setPrintLayout] = useState<'individual' | 'a4-grid'>('a4-grid');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedStudentIds(new Set(students.map((s) => s.id)));
  };

  const deselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const selectedStudents = students.filter((s) => selectedStudentIds.has(s.id));

  const generateBatchHtmlDoc = () => {
    const svgs = selectedStudents.map((st) =>
      generateStudentCardSvg(st, settings, {
        themeId: selectedTheme,
        academicYear,
      })
    );

    const pageCss = printLayout === 'individual'
      ? `@page { size: 80mm 50mm; margin: 0; }
         *, *::before, *::after { box-sizing: border-box; }
         html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
         .badge-page { width: 80mm !important; height: 50mm !important; page-break-after: always; break-after: page; overflow: hidden; }
         .badge-page svg { width: 80mm !important; height: 50mm !important; display: block; }`
      : `@page { size: A4 portrait; margin: 8mm 6mm; }
         *, *::before, *::after { box-sizing: border-box; }
         html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
         .a4-grid { display: grid; grid-template-columns: repeat(2, 80mm); gap: 10mm 12mm; justify-content: center; padding-top: 5mm; margin: 0 auto; }
         .card-cell { width: 80mm; height: 50mm; position: relative; border: 1px dashed #cbd5e1; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
         .card-cell svg { width: 80mm; height: 50mm; display: block; }
         .cut-mark { position: absolute; font-size: 9px; color: #94a3b8; font-family: monospace; line-height: 1; user-select: none; }`;

    let bodyHtml = '';
    if (printLayout === 'individual') {
      bodyHtml = svgs.map((svg) => `<div class="badge-page">${svg}</div>`).join('');
    } else {
      bodyHtml = `<div class="a4-grid">` + svgs.map((svg) => `
        <div class="card-cell">
          <span class="cut-mark" style="top:-3.5mm;left:-3.5mm;">+</span>
          <span class="cut-mark" style="top:-3.5mm;right:-3.5mm;">+</span>
          <span class="cut-mark" style="bottom:-3.5mm;left:-3.5mm;">+</span>
          <span class="cut-mark" style="bottom:-3.5mm;right:-3.5mm;">+</span>
          ${svg}
        </div>
      `).join('') + `</div>`;
    }

    const screenBarHtml = `
      <div id="screen-print-bar" style="
        background: #0f172a;
        color: #ffffff;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 20px;">🖨️</div>
          <div>
            <div style="font-weight: 800; font-size: 15px;">
              Stampa Massiva: ${selectedStudents.length} Tessere (${printLayout === 'individual' ? 'Badge 80x50 mm' : 'Foglio A4'})
            </div>
            <div style="font-size: 12px; color: #94a3b8;">
              Consiglio: seleziona <strong>Margini: Nessuno</strong> e attiva <strong>Grafica di sfondo</strong>.
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button onclick="window.print()" style="
            background: #2563eb;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
          ">
            Avvia Stampa (Ctrl+P)
          </button>
          <button onclick="window.close()" style="
            background: #334155;
            color: #e2e8f0;
            border: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 12px;
            cursor: pointer;
          ">
            Chiudi
          </button>
        </div>
      </div>
    `;

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>Stampa Massiva ${selectedStudents.length} Tessere Barcode</title>
  <style>
    ${pageCss}
    @media screen {
      body { margin: 0; background: #f8fafc; }
      .screen-wrapper { padding: 20px; display: flex; justify-content: center; }
    }
    @media print {
      #screen-print-bar { display: none !important; }
      .screen-wrapper { padding: 0 !important; }
    }
  </style>
</head>
<body>
  ${screenBarHtml}
  <div class="screen-wrapper">
    ${bodyHtml}
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try { window.focus(); window.print(); } catch (e) {}
      }, 250);
    });
  </script>
</body>
</html>`;
  };

  const handlePrint = () => {
    if (selectedStudents.length === 0) return;
    setIsPrinting(true);
    triggerScanFeedback('info', `Avvio stampa di ${selectedStudents.length} tessere...`);

    const htmlDoc = generateBatchHtmlDoc();

    // Silent iframe print
    let printFrame = document.getElementById('biblio-batch-print-frame') as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement('iframe');
      printFrame.id = 'biblio-batch-print-frame';
      printFrame.setAttribute(
        'style',
        'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'
      );
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      try {
        frameDoc.open();
        frameDoc.write(htmlDoc);
        frameDoc.close();
        setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (e) {
            handleOpenNewTab();
          }
        }, 300);
      } catch (err) {
        handleOpenNewTab();
      }
    } else {
      handleOpenNewTab();
    }
  };

  const handleOpenNewTab = () => {
    if (selectedStudents.length === 0) return;
    triggerScanFeedback('info', 'Apertura anteprima di stampa massiva in una nuova scheda...');
    const htmlDoc = generateBatchHtmlDoc();
    try {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/print-card';
      form.target = '_blank';
      form.style.display = 'none';

      const inputHtml = document.createElement('input');
      inputHtml.type = 'hidden';
      inputHtml.name = 'html';
      inputHtml.value = htmlDoc;
      form.appendChild(inputHtml);

      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try { document.body.removeChild(form); } catch (e) {}
      }, 2000);
    } catch (err) {
      handleDownloadBatchHtml();
    }
  };

  const handleDownloadBatchHtml = () => {
    if (selectedStudents.length === 0) return;
    try {
      const htmlContent = generateBatchHtmlDoc();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `Stampa_Massiva_${selectedStudents.length}_Tessere.html`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (e) {}
      }, 60000);

      triggerScanFeedback('success', 'File HTML per la stampa massiva scaricato!');
    } catch (err) {
      console.error(err);
      triggerScanFeedback('error', 'Errore nella generazione del file di stampa');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 animate-fadeIn flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">Stampa Multipla Tessere Barcode</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  80 x 50 mm
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Stampa in blocco tessere badge per tutta la classe o per gli alunni selezionati
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Selection buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5 shadow-xs"
            >
              <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
              Tutti ({students.length})
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5 shadow-xs"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              Deseleziona
            </button>
            <span className="text-slate-600 ml-1 font-semibold">
              Selezionati: <strong className="text-indigo-600 font-extrabold">{selectedStudents.length}</strong>
            </span>
          </div>

          {/* Theme & Layout Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={selectedTheme}
                onChange={(e) => setSelectedTheme(e.target.value as CardThemeId)}
                className="px-2.5 py-1.5 font-bold bg-white border border-slate-300 rounded-xl text-slate-700"
              >
                {(Object.keys(CARD_THEMES) as CardThemeId[]).map((themeKey) => (
                  <option key={themeKey} value={themeKey}>
                    {CARD_THEMES[themeKey].name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Layout:</span>
              <select
                value={printLayout}
                onChange={(e) => setPrintLayout(e.target.value as any)}
                className="px-2.5 py-1.5 font-bold bg-white border border-slate-300 rounded-xl text-slate-700"
              >
                <option value="a4-grid">Foglio A4 (Griglia 80x50 mm con crocini)</option>
                <option value="individual">Rotolo / Singole 80x50 mm</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              disabled={selectedStudents.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center gap-2 transition shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Avvia Stampa ({selectedStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              disabled={selectedStudents.length === 0}
              className="px-3 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 disabled:opacity-40 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Apri anteprima di stampa massiva a tutto schermo in una nuova scheda"
            >
              <ExternalLink className="w-4 h-4 text-indigo-600" />
              <span>Nuova Scheda</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadBatchHtml}
              disabled={selectedStudents.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 disabled:opacity-40 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Scarica file HTML per stampare esternamente"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-600" />
              <span>File HTML</span>
            </button>
          </div>
        </div>

        {/* Student Checklist & Previews */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {students.map((student) => {
              const isSelected = selectedStudentIds.has(student.id);
              return (
                <div
                  key={student.id}
                  onClick={() => toggleSelect(student.id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-xs truncate">
                      {student.lastName} {student.firstName}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="font-semibold text-indigo-700">Cl. {student.classSection}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-600">{student.studentCode}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedStudents.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-700">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Anteprima Primo Badge Generato (80x50 mm):</span>
              </div>
              <div className="flex justify-center p-4 bg-slate-100 rounded-2xl border border-slate-200">
                <div
                  className="w-[420px] max-w-full rounded-2xl shadow-lg overflow-hidden border border-slate-300/80 bg-white"
                  style={{ aspectRatio: '80 / 50' }}
                  dangerouslySetInnerHTML={{
                    __html: generateStudentCardSvg(selectedStudents[0], settings, {
                      themeId: selectedTheme,
                      academicYear,
                    }),
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>Dimensione esatta per tessera: 80 mm larghezza x 50 mm altezza.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Portal directly in document.body for clean, reliable batch printing */}
      {isPrinting && typeof document !== 'undefined' && createPortal(
        <div id="print-portal-mount">
          <style>{`
            @page {
              size: ${printLayout === 'individual' ? '80mm 50mm' : 'A4 portrait'};
              margin: ${printLayout === 'individual' ? '0' : '8mm 6mm'};
            }
          `}</style>
          {printLayout === 'individual' ? (
            <div>
              {selectedStudents.map((st) => (
                <div
                  key={st.id}
                  style={{
                    width: '80mm',
                    height: '50mm',
                    margin: 0,
                    padding: 0,
                    pageBreakAfter: 'always',
                    breakAfter: 'page',
                    overflow: 'hidden',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: generateStudentCardSvg(st, settings, {
                      themeId: selectedTheme,
                      academicYear,
                    }),
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{
              width: '190mm',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 80mm)',
              gap: '10mm 12mm',
              justifyContent: 'center',
              paddingTop: '5mm',
            }}>
              {selectedStudents.map((st) => (
                <div
                  key={st.id}
                  style={{
                    width: '80mm',
                    height: '50mm',
                    position: 'relative',
                    border: '1px dashed #cbd5e1',
                    boxSizing: 'border-box',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}
                >
                  <span style={{ position: 'absolute', top: '-3.5mm', left: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', top: '-3.5mm', right: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', bottom: '-3.5mm', left: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', bottom: '-3.5mm', right: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <div
                    style={{ width: '80mm', height: '50mm', overflow: 'hidden' }}
                    dangerouslySetInnerHTML={{
                      __html: generateStudentCardSvg(st, settings, {
                        themeId: selectedTheme,
                        academicYear,
                      }),
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
