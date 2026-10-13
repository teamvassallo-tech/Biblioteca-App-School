import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Student } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import {
  CARD_THEMES,
  CardThemeId,
  generateStudentCardSvg,
  downloadStudentCardPng,
  downloadStudentCardSvg,
  downloadPrintableHtmlFile,
  executeCardPrint,
  openPrintPageInNewTab,
} from '../../utils/studentCardRenderer';
import {
  X,
  Printer,
  Download,
  FileImage,
  Palette,
  Sparkles,
  Maximize2,
  CheckCircle2,
  Layers,
  Info,
  FileCode,
  ExternalLink
} from 'lucide-react';

interface StudentCardModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  isNewlyCreated?: boolean;
}

export const StudentCardModal: React.FC<StudentCardModalProps> = ({
  student,
  isOpen,
  onClose,
  isNewlyCreated = false,
}) => {
  const { settings, triggerScanFeedback } = useLibrary();

  const [selectedTheme, setSelectedTheme] = useState<CardThemeId>('navy');
  const [academicYear, setAcademicYear] = useState('A.S. 2025/2026');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [printMode, setPrintMode] = useState<'single' | 'a4-sheet' | null>(null);

  if (!isOpen) return null;

  // Generate SVG code for the student
  const cardSvg = generateStudentCardSvg(student, settings, {
    themeId: selectedTheme,
    academicYear,
  });

  const handlePrintSingle = () => {
    setPrintMode('single');
    triggerScanFeedback('info', 'Invio comando di stampa badge (80 x 50 mm)...');

    // Execute through dedicated silent print engine
    const success = executeCardPrint(
      cardSvg,
      'single',
      `Tessera_${student.lastName}_${student.firstName}_80x50mm`
    );

    if (!success) {
      triggerScanFeedback('info', 'Apertura scheda di stampa in nuova finestra...');
    }
  };

  const handlePrintA4 = () => {
    setPrintMode('a4-sheet');
    triggerScanFeedback('info', 'Invio comando di stampa foglio A4 (8 tessere)...');

    // Execute through dedicated silent print engine
    const success = executeCardPrint(
      cardSvg,
      'a4-sheet',
      `FoglioA4_${student.lastName}_${student.firstName}_80x50mm`
    );

    if (!success) {
      triggerScanFeedback('info', 'Apertura scheda di stampa in nuova finestra...');
    }
  };

  const handleOpenDedicatedTab = (mode: 'single' | 'a4-sheet') => {
    triggerScanFeedback('info', 'Apertura pagina di stampa dedicata senza restrizioni...');
    openPrintPageInNewTab(
      cardSvg,
      mode,
      `Stampa_${student.lastName}_${student.firstName}_${mode === 'single' ? '80x50mm' : 'FoglioA4'}`
    );
  };

  const handleDownloadPng = async () => {
    try {
      setIsExporting(true);
      await downloadStudentCardPng(student, settings, {
        themeId: selectedTheme,
        academicYear,
      });
      triggerScanFeedback('success', 'File PNG 80x50 mm ad alta risoluzione (300 DPI) generato e salvato!');
    } catch (err) {
      console.error('PNG download error:', err);
      triggerScanFeedback('error', 'Errore durante la generazione del file immagine PNG.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSvg = () => {
    try {
      downloadStudentCardSvg(student, settings, {
        themeId: selectedTheme,
        academicYear,
      });
      triggerScanFeedback('success', 'File vettoriale SVG 80x50 mm scaricato con successo!');
    } catch (err) {
      console.error('SVG download error:', err);
      triggerScanFeedback('error', 'Errore durante il download del file SVG.');
    }
  };

  const handleDownloadHtml = () => {
    try {
      downloadPrintableHtmlFile(
        cardSvg,
        'single',
        `Stampa_Tessera_${student.lastName}_${student.firstName}_80x50mm`
      );
      triggerScanFeedback('success', 'File HTML di stampa 80x50 mm scaricato! Aprilo per stampare con layout perfetto.');
    } catch (err) {
      console.error('HTML download error:', err);
      triggerScanFeedback('error', 'Errore durante il download del file di stampa HTML.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      {/* Screen Modal Container */}
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 animate-fadeIn flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-indigo-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg">Tessera Barcode Alunno / Lettore</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  80 x 50 mm
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Design professionale e stampa diretta per badge e fogli A4
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
            title="Chiudi finestra"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Success Banner if newly created */}
          {isNewlyCreated && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-900 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <strong className="font-bold text-sm block">Alunno registrato con successo!</strong>
                  La tessera barcode per <strong>{student.firstName} {student.lastName}</strong> è pronta per la stampa nel formato 80x50 mm.
                </div>
              </div>
              <button
                type="button"
                onClick={handlePrintSingle}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa Subito</span>
              </button>
            </div>
          )}

          {/* Theme & Year Selectors Bar */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Palette className="w-4 h-4 text-indigo-600" />
                <span>Stile &amp; Palette Colori:</span>
              </div>

              {/* Theme Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(CARD_THEMES) as CardThemeId[]).map((themeKey) => {
                  const t = CARD_THEMES[themeKey];
                  const isActive = selectedTheme === themeKey;
                  return (
                    <button
                      key={themeKey}
                      type="button"
                      onClick={() => setSelectedTheme(themeKey)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                        isActive
                          ? 'bg-white shadow-xs border-indigo-600 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'bg-white/60 hover:bg-white text-slate-600 border-slate-200'
                      }`}
                      title={t.name}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                      <span>{t.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Academic Year & Size Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Anno Scolastico:</span>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg w-28 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="A.S. 2025/2026"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Dimensioni:</span>
                <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                  80 x 50 mm (800 x 500 pt)
                </span>
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="p-1 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-white transition"
                  title={isZoomed ? 'Scala standard' : 'Ingrandisci anteprima'}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Card Physical Preview Area */}
          <div className="bg-slate-100/80 p-4 sm:p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
            <div className="text-[11px] font-semibold text-slate-500 mb-2.5 flex items-center gap-1.5">
              <span>Anteprima Tessera Barcode (Rapporto esatto 80 mm x 50 mm)</span>
            </div>

            {/* The Interactive Preview Component */}
            <div
              className={`transition-all duration-200 rounded-2xl shadow-xl overflow-hidden border border-slate-300/80 bg-white ${
                isZoomed
                  ? 'w-[560px] max-w-full'
                  : 'w-[440px] max-w-full'
              }`}
              style={{
                aspectRatio: '80 / 50',
              }}
              dangerouslySetInnerHTML={{ __html: cardSvg }}
            />

            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Barcode Code-128 conforme agli standard ottici. I testi e i margini sono dimensionati senza sovrapposizioni.
              </span>
            </div>
          </div>

          {/* Print & Export Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Direct 80x50 mm Print Card */}
            <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Stampa Badge Singolo (80 x 50 mm)</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Invia direttamente alla stampante il badge a misura esatta 80x50 mm (ideale per stampanti termiche, etichettatrici o tessere).
                </p>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handlePrintSingle}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Stampa Badge Subito</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDedicatedTab('single')}
                  className="w-full py-1.5 px-3 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Apri a schermo intero in una nuova scheda senza restrizioni di anteprima"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Apri Scheda di Stampa (Nuova Scheda)</span>
                </button>
              </div>
            </div>

            {/* A4 Sheet Print Card */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Layers className="w-4 h-4 text-slate-700" />
                    <span>Foglio A4 (8 Tessere)</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    Con crocini
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Dispone 8 copie su un normale foglio A4 con guide di taglio tratteggiate per taglierina o forbici.
                </p>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handlePrintA4}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Stampa Foglio A4 (8 Tessere)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDedicatedTab('a4-sheet')}
                  className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Apri il foglio A4 in una nuova scheda per stampare direttamente"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Apri Foglio A4 in Nuova Scheda</span>
                </button>
              </div>
            </div>
          </div>

          {/* Download Graphics & Standalone Print Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200 text-xs">
            <span className="font-semibold text-slate-600">Esporta File 80 x 50 mm:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isExporting}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                title="Scarica file immagine PNG ad alta risoluzione 300 DPI, apribile su qualsiasi dispositivo"
              >
                <FileImage className="w-4 h-4 text-emerald-600" />
                <span>{isExporting ? 'Generazione...' : 'Scarica PNG (300 DPI)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition shadow-xs"
                title="Scarica file vettoriale SVG per tipografia o plotter"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Scarica Vettoriale SVG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition"
                title="Scarica file HTML autonomo: aprilo nel browser per stampare con layout 80x50 mm garantito"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-600" />
                <span>File Stampa HTML</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition"
          >
            Chiudi Finestra
          </button>
        </div>
      </div>

      {/* Portal directly in document.body for clean, reliable printing without modal clipping */}
      {printMode && typeof document !== 'undefined' && createPortal(
        <div id="print-portal-mount">
          <style>{`
            @page {
              size: ${printMode === 'single' ? '80mm 50mm' : 'A4 portrait'};
              margin: ${printMode === 'single' ? '0' : '8mm 6mm'};
            }
          `}</style>
          {printMode === 'single' ? (
            <div style={{ width: '80mm', height: '50mm', margin: 0, padding: 0, overflow: 'hidden' }}
                 dangerouslySetInnerHTML={{ __html: cardSvg }}
            />
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
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ width: '80mm', height: '50mm', position: 'relative', border: '1px dashed #cbd5e1' }}>
                  <span style={{ position: 'absolute', top: '-3.5mm', left: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', top: '-3.5mm', right: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', bottom: '-3.5mm', left: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <span style={{ position: 'absolute', bottom: '-3.5mm', right: '-3.5mm', fontSize: '9px', color: '#94a3b8' }}>+</span>
                  <div style={{ width: '80mm', height: '50mm', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: cardSvg }} />
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
