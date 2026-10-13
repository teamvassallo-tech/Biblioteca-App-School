import React, { useEffect } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ScanFeedbackBanner: React.FC = () => {
  const { scanToast, clearScanToast } = useLibrary();

  useEffect(() => {
    if (!scanToast) return;
    const timer = setTimeout(() => {
      clearScanToast();
    }, 4500);
    return () => clearTimeout(timer);
  }, [scanToast, clearScanToast]);

  if (!scanToast) return null;

  const isSuccess = scanToast.type === 'success';
  const isError = scanToast.type === 'error';

  return (
    <aside
      aria-label="Notifica di scansione"
      className="fixed top-4 right-4 left-4 md:left-auto md:max-w-md z-50 pointer-events-auto"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 ${
          isSuccess
            ? 'bg-emerald-900/95 text-white border-emerald-500 shadow-emerald-950/20'
            : isError
            ? 'bg-rose-900/95 text-white border-rose-500 shadow-rose-950/20'
            : 'bg-slate-900/95 text-white border-slate-700 shadow-slate-950/20'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="w-6 h-6 text-emerald-300 animate-bounce" />}
          {isError && <AlertCircle className="w-6 h-6 text-rose-300 animate-pulse" />}
          {!isSuccess && !isError && <Info className="w-6 h-6 text-sky-300" />}
        </div>
        <div className="flex-1 pr-2">
          <div className="font-semibold text-sm tracking-wide uppercase opacity-80 mb-0.5">
            {isSuccess ? 'Scansione Riuscita' : isError ? 'Attenzione' : 'Notifica Sistema'}
          </div>
          <div className="text-sm leading-snug font-medium text-slate-100">
            {scanToast.message}
          </div>
        </div>
        <button
          onClick={clearScanToast}
          className="text-slate-300 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
          title="Chiudi notifica"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
