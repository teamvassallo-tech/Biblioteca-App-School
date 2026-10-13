import React, { useState } from 'react';
import { useLibrary } from '../context/LibraryContext';
import { getThemeClasses, getPresetById, getContentWidthClass } from '../utils/layoutPresets';
import {
  BookOpen,
  ArrowLeftRight,
  Library,
  GraduationCap,
  Sparkles,
  Settings,
  Volume2,
  VolumeX,
  AlertTriangle,
  Plus,
  Menu,
  X,
  Palette
} from 'lucide-react';

export type NavTab = 'dashboard' | 'catalogo' | 'alunni' | 'ai' | 'impostazioni';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenAddBookModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenAddBookModal }) => {
  const { books, loans, settings, updateSettings } = useLibrary();

  const theme = getThemeClasses(settings.colorTheme);
  const activePreset = getPresetById(settings.visualLayoutPreset);
  const contentWidthClass = getContentWidthClass(settings.contentWidth);
  const activeLoansCount = loans.filter((l) => l.status === 'Attivo' || l.status === 'In Ritardo').length;
  const overdueLoansCount = loans.filter((l) => l.status === 'In Ritardo').length;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Banner / Identity */}
      <div className={`${contentWidthClass} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="flex items-center justify-between h-16 sm:h-18 gap-2">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr ${theme.brandGradient} flex items-center justify-center text-white shadow-md`}>
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
                  {settings.libraryName || 'BiblioScuola'}
                </span>
                <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${theme.activeBadge}`}>
                  {settings.schoolName || 'Scuola'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                Gestionale Biblioteca Scolastica • Barcode USB Scanner Ready
              </p>
            </div>
          </div>

          {/* Right Status & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Metrics Badge */}
            <div className="hidden lg:flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5 text-xs text-slate-600">
              <span>
                Libri: <strong className="text-slate-800 font-semibold">{books.length}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Prestiti attivi:{' '}
                <strong className={`${theme.accentText} font-semibold`}>{activeLoansCount}</strong>
              </span>
              {overdueLoansCount > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {overdueLoansCount} in ritardo
                  </span>
                </>
              )}
            </div>

            {/* Layout Preset Badge Indicator */}
            <button
              type="button"
              onClick={() => onSelectTab('impostazioni')}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition cursor-pointer"
              title={`Layout Attivo: ${activePreset.name}. Clicca per cambiare layout nelle Impostazioni.`}
            >
              <Palette className="w-3.5 h-3.5 text-slate-500" />
              <span>{activePreset.name}</span>
            </button>

            {/* Quick Action: Cataloga Nuovo Libro */}
            {onOpenAddBookModal && (
              <button
                type="button"
                onClick={onOpenAddBookModal}
                className={`px-3 sm:px-3.5 py-1.5 sm:py-2 ${theme.primaryBtn} rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer`}
                title="Cataloga un nuovo libro via ISBN o OCR"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline sm:inline">Cataloga Libro</span>
              </button>
            )}

            {/* Sound Toggle Button */}
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                settings.soundEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title={settings.soundEnabled ? 'Suoni scanner attivi (Bip)' : 'Suoni scanner disattivati'}
            >
              {settings.soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline font-medium">Bip ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span className="hidden sm:inline font-medium">Bip OFF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="border-t border-slate-100 bg-slate-50/70">
        <div className={`${contentWidthClass} mx-auto px-4 sm:px-6 lg:px-8`}>
          <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Dashboard & Prestiti</span>
              {overdueLoansCount > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    currentTab === 'dashboard'
                      ? 'bg-rose-400 text-slate-950'
                      : 'bg-rose-600 text-white animate-pulse'
                  }`}
                >
                  {overdueLoansCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('catalogo')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                currentTab === 'catalogo'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Library className="w-4 h-4" />
              <span>Catalogo Libri</span>
              <span className="text-[11px] opacity-75 font-normal">({books.length})</span>
            </button>

            <button
              onClick={() => onSelectTab('alunni')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                currentTab === 'alunni'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Anagrafica Alunni</span>
            </button>

            <button
              onClick={() => onSelectTab('ai')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                currentTab === 'ai'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Cerca con AI</span>
            </button>

            <button
              onClick={() => onSelectTab('impostazioni')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap ${
                currentTab === 'impostazioni'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Impostazioni & Reset</span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};

/**
 * Sidebar Navigation Layout (Vertical Desktop Sidebar + Mobile Topbar)
 */
export const SidebarNavbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddBookModal,
}) => {
  const { books, loans, settings, updateSettings } = useLibrary();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const theme = getThemeClasses(settings.colorTheme);
  const activePreset = getPresetById(settings.visualLayoutPreset);
  const activeLoansCount = loans.filter((l) => l.status === 'Attivo' || l.status === 'In Ritardo').length;
  const overdueLoansCount = loans.filter((l) => l.status === 'In Ritardo').length;

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Topbar when in Sidebar mode */}
      <div className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${theme.brandGradient} flex items-center justify-center text-white`}>
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-sm block leading-tight">
              {settings.libraryName || 'BiblioScuola'}
            </span>
            <span className="text-[11px] text-slate-500">
              {settings.schoolName || 'Scuola'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenAddBookModal && (
            <button
              type="button"
              onClick={onOpenAddBookModal}
              className={`p-2 ${theme.primaryBtn} rounded-lg text-xs font-bold`}
              title="Cataloga Libro"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            title="Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-2 sticky top-[57px] z-30 shadow-lg animate-fadeIn">
          <button
            onClick={() => handleNavClick('dashboard')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              currentTab === 'dashboard' ? theme.activeNavTab : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              <span>Dashboard & Prestiti</span>
            </span>
            {overdueLoansCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-bold">
                {overdueLoansCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavClick('catalogo')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              currentTab === 'catalogo' ? theme.activeNavTab : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Library className="w-4 h-4" />
              <span>Catalogo Libri</span>
            </span>
            <span className="text-xs opacity-75">({books.length})</span>
          </button>

          <button
            onClick={() => handleNavClick('alunni')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              currentTab === 'alunni' ? theme.activeNavTab : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Anagrafica Alunni</span>
          </button>

          <button
            onClick={() => handleNavClick('ai')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              currentTab === 'ai' ? theme.activeNavTab : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Cerca con AI</span>
          </button>

          <button
            onClick={() => handleNavClick('impostazioni')}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
              currentTab === 'impostazioni' ? theme.activeNavTab : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Impostazioni & Reset</span>
          </button>
        </div>
      )}

      {/* Desktop Vertical Sidebar */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 h-screen sticky top-0 bg-white border-r border-slate-200 z-30 shrink-0 justify-between p-5 overflow-y-auto no-scrollbar shadow-xs">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${theme.brandGradient} flex items-center justify-center text-white shadow-md shrink-0`}>
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-slate-900 text-lg leading-tight truncate">
                {settings.libraryName || 'BiblioScuola'}
              </h1>
              <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                {settings.schoolName || 'Scuola'}
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          {onOpenAddBookModal && (
            <button
              type="button"
              onClick={onOpenAddBookModal}
              className={`w-full py-2.5 px-3.5 ${theme.primaryBtn} rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer`}
              title="Cataloga un nuovo libro via ISBN o OCR"
            >
              <Plus className="w-4 h-4" />
              <span>+ Cataloga Nuovo Libro</span>
            </button>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3">
              Menu Principale
            </span>

            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'dashboard'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ArrowLeftRight className="w-4 h-4 shrink-0" />
                <span>Dashboard Prestiti</span>
              </div>
              {overdueLoansCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  currentTab === 'dashboard' ? 'bg-rose-400 text-slate-950' : 'bg-rose-600 text-white'
                }`}>
                  {overdueLoansCount} ritardi
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('catalogo')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'catalogo'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Library className="w-4 h-4 shrink-0" />
                <span>Catalogo Libri</span>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                currentTab === 'catalogo' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {books.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('alunni')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'alunni'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>Anagrafica Alunni</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('ai')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'ai'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                <span>Cerca con AI</span>
              </div>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                Smart
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('impostazioni')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'impostazioni'
                  ? `${theme.activeNavTab} shadow-sm`
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 shrink-0" />
                <span>Impostazioni & Reset</span>
              </div>
            </button>
          </nav>

          {/* Quick Metrics Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Stato Biblioteca
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Volumi catalogati:</span>
              <strong className="text-slate-900 font-bold">{books.length}</strong>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Prestiti attivi:</span>
              <strong className={`${theme.accentText} font-bold`}>{activeLoansCount}</strong>
            </div>
            {overdueLoansCount > 0 && (
              <div className="flex items-center justify-between text-rose-700 font-bold pt-1 border-t border-slate-200">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  In ritardo:
                </span>
                <span>{overdueLoansCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer info & Sound switch */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelectTab('impostazioni')}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Configura layout visivo nelle Impostazioni"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">{activePreset.name}</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                settings.soundEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title={settings.soundEnabled ? 'Bip scanner attivo' : 'Bip scanner disattivato'}
            >
              {settings.soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold">ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold">OFF</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[10px] text-slate-400 text-center">
            BiblioScuola • Scuola Italiana
          </div>
        </div>
      </aside>
    </>
  );
};

