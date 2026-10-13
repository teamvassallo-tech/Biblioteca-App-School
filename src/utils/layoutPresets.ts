import {
  VisualLayoutPreset,
  VisualLayoutPresetId,
  NavPosition,
  ContentDensity,
  ContentWidth,
  ColorTheme,
  FontSize,
  AppSettings,
} from '../types';

export const VISUAL_LAYOUT_PRESETS: VisualLayoutPreset[] = [
  {
    id: 'standard',
    name: 'Standard Scolastico',
    subtitle: 'Classico & Bilanciato',
    description:
      'Navigazione orizzontale superiore con larghezza ottimale. Il layout tradizionale collaudato per computer portatili e postazioni ordinarie della biblioteca.',
    badge: 'Predefinito',
    iconName: 'Building',
    settings: {
      navPosition: 'top',
      contentDensity: 'comfortable',
      contentWidth: 'contained',
      colorTheme: 'indigo',
      fontSize: 'normal',
    },
  },
  {
    id: 'lim_touch',
    name: 'LIM & Touchscreen',
    subtitle: 'Lavagne Interattive & Tablet',
    description:
      'Elementi ingranditi, pulsanti con target touch maggiorato e font ad alta visibilità. Ideale per l\'uso su LIM, lavagne multimediali e monitor touch in classe.',
    badge: 'Consigliato per LIM',
    iconName: 'Monitor',
    settings: {
      navPosition: 'top',
      contentDensity: 'spacious',
      contentWidth: 'wide',
      colorTheme: 'blue',
      fontSize: 'large',
    },
  },
  {
    id: 'compact_desk',
    name: 'Banco Prestiti & Alta Densità',
    subtitle: 'Postazione Barcode Veloce',
    description:
      'Spaziature compatte a tutto schermo (Full-Width) per visualizzare il massimo numero di volumi e prestiti senza scorrere. Perfetto durante le ricreazioni con lettore barcode.',
    badge: 'Alta Produttività',
    iconName: 'Zap',
    settings: {
      navPosition: 'top',
      contentDensity: 'compact',
      contentWidth: 'full',
      colorTheme: 'emerald',
      fontSize: 'normal',
    },
  },
  {
    id: 'sidebar_modern',
    name: 'Sidebar Gestionale',
    subtitle: 'Barra Laterale Desktop',
    description:
      'Menu verticale fisso a sinistra in stile gestionale professionale. Massimizza lo spazio verticale utile per tabelle, elenchi alunni e cataloghi ricchi di copertine.',
    badge: 'Stile Gestionale',
    iconName: 'LayoutGrid',
    settings: {
      navPosition: 'sidebar',
      contentDensity: 'comfortable',
      contentWidth: 'full',
      colorTheme: 'indigo',
      fontSize: 'normal',
    },
  },
  {
    id: 'accessibility',
    name: 'Accessibilità & Alto Contrasto',
    subtitle: 'Leggibilità Facilitata & Ipovisione',
    description:
      'Spaziatura distesa, contrasti tonali caldi e definiti, bordi rinforzati e font leggibile. Ottimale per alunni con bisogni educativi speciali o ambienti molto illuminati.',
    badge: 'Leggibilità Massima',
    iconName: 'Eye',
    settings: {
      navPosition: 'top',
      contentDensity: 'spacious',
      contentWidth: 'contained',
      colorTheme: 'amber',
      fontSize: 'large',
    },
  },
];

export interface ColorThemeOption {
  id: ColorTheme;
  name: string;
  description: string;
  primaryHex: string;
  lightHex: string;
  badgeClass: string;
  accentClass: string;
}

export const COLOR_THEME_OPTIONS: ColorThemeOption[] = [
  {
    id: 'indigo',
    name: 'Indigo Classico',
    description: 'Il blu cobalto/viola istituzionale BiblioScuola',
    primaryHex: '#4f46e5',
    lightHex: '#eef2ff',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentClass: 'text-indigo-600',
  },
  {
    id: 'blue',
    name: 'Blu Istituzionale',
    description: 'Azzurro ministeriale sereno e professionale',
    primaryHex: '#2563eb',
    lightHex: '#eff6ff',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    accentClass: 'text-blue-600',
  },
  {
    id: 'emerald',
    name: 'Smeraldo Biblioteca',
    description: 'Verde naturale, stimola concentrazione e calma',
    primaryHex: '#059669',
    lightHex: '#ecfdf5',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentClass: 'text-emerald-600',
  },
  {
    id: 'amber',
    name: 'Ambra Scolastica',
    description: 'Toni caldi e accoglienti, stimola la creatività',
    primaryHex: '#d97706',
    lightHex: '#fffbeb',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    accentClass: 'text-amber-600',
  },
  {
    id: 'slate',
    name: 'Ardesia Moderno',
    description: 'Grigio scuro neutro ad alto contrasto formale',
    primaryHex: '#1e293b',
    lightHex: '#f1f5f9',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    accentClass: 'text-slate-800',
  },
  {
    id: 'rose',
    name: 'Borgogna Accademico',
    description: 'Rosso accademico elegante e distintivo',
    primaryHex: '#e11d48',
    lightHex: '#fff1f2',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    accentClass: 'text-rose-600',
  },
];

export const NAV_POSITION_OPTIONS: { id: NavPosition; label: string; description: string }[] = [
  {
    id: 'top',
    label: 'Barra Superiore',
    description: 'Navigazione orizzontale in alto, adatta a tutti i dispositivi',
  },
  {
    id: 'sidebar',
    label: 'Sidebar Laterale',
    description: 'Colonna verticale fissa a sinistra, ideale per schermi ampi',
  },
];

export const DENSITY_OPTIONS: { id: ContentDensity; label: string; description: string }[] = [
  {
    id: 'compact',
    label: 'Compatta',
    description: 'Spaziature minime, più informazioni a colpo d\'occhio',
  },
  {
    id: 'comfortable',
    label: 'Confortevole',
    description: 'Spaziatura bilanciata standard per lettura rilassata',
  },
  {
    id: 'spacious',
    label: 'Spaziosa',
    description: 'Margini ampi e touch target generosi per LIM e tablet',
  },
];

export const CONTENT_WIDTH_OPTIONS: { id: ContentWidth; label: string; description: string }[] = [
  {
    id: 'contained',
    label: 'Centrata (1280px)',
    description: 'Contenitore standard max-w-7xl con margini laterali comodi',
  },
  {
    id: 'wide',
    label: 'Ampia (1600px)',
    description: 'Contenitore esteso per monitor 24-27 pollici',
  },
  {
    id: 'full',
    label: 'A Tutto Schermo (100%)',
    description: 'Occupa l\'intera larghezza del display senza limiti',
  },
];

export const FONT_SIZE_OPTIONS: { id: FontSize; label: string; description: string }[] = [
  {
    id: 'normal',
    label: 'Dimensione Standard',
    description: 'Caratteri regolari al 100% per postazione desktop',
  },
  {
    id: 'large',
    label: 'Ingrandita (LIM & Ipovedenti)',
    description: 'Caratteri e icone ingranditi per visione da distanza',
  },
];

export function getPresetById(id?: VisualLayoutPresetId): VisualLayoutPreset {
  const found = VISUAL_LAYOUT_PRESETS.find((p) => p.id === id);
  return found || VISUAL_LAYOUT_PRESETS[0];
}

/**
 * Checks whether current app settings exactly match a known preset
 */
export function getActiveMatchingPreset(settings: AppSettings): VisualLayoutPreset | null {
  const currentNav = settings.navPosition || 'top';
  const currentDensity = settings.contentDensity || 'comfortable';
  const currentWidth = settings.contentWidth || 'contained';
  const currentTheme = settings.colorTheme || 'indigo';
  const currentFont = settings.fontSize || 'normal';

  for (const preset of VISUAL_LAYOUT_PRESETS) {
    const s = preset.settings;
    if (
      s.navPosition === currentNav &&
      s.contentDensity === currentDensity &&
      s.contentWidth === currentWidth &&
      s.colorTheme === currentTheme &&
      s.fontSize === currentFont
    ) {
      return preset;
    }
  }

  return null;
}

/**
 * Returns Tailwind class for container max-width
 */
export function getContentWidthClass(width?: ContentWidth): string {
  switch (width) {
    case 'wide':
      return 'max-w-[1600px]';
    case 'full':
      return 'max-w-none';
    case 'contained':
    default:
      return 'max-w-7xl';
  }
}

/**
 * Returns Tailwind padding classes for density
 */
export function getDensityPaddingClass(density?: ContentDensity): string {
  switch (density) {
    case 'compact':
      return 'py-3 sm:py-4 px-3 sm:px-4 lg:px-6';
    case 'spacious':
      return 'py-8 sm:py-10 px-5 sm:px-8 lg:px-10';
    case 'comfortable':
    default:
      return 'py-6 sm:py-8 px-4 sm:px-6 lg:px-8';
  }
}

/**
 * Theme style mapping for primary actions and active states
 */
export function getThemeClasses(theme?: ColorTheme) {
  switch (theme) {
    case 'blue':
      return {
        brandGradient: 'from-blue-600 to-blue-800',
        primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
        activeNavTab: 'bg-blue-600 text-white shadow-blue-600/20',
        activeBadge: 'bg-blue-50 text-blue-700 border-blue-200',
        accentText: 'text-blue-600',
        accentBg: 'bg-blue-50',
        borderAccent: 'border-blue-300',
        ringAccent: 'focus:ring-blue-500',
      };
    case 'emerald':
      return {
        brandGradient: 'from-emerald-600 to-emerald-800',
        primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
        activeNavTab: 'bg-emerald-600 text-white shadow-emerald-600/20',
        activeBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        accentText: 'text-emerald-600',
        accentBg: 'bg-emerald-50',
        borderAccent: 'border-emerald-300',
        ringAccent: 'focus:ring-emerald-500',
      };
    case 'amber':
      return {
        brandGradient: 'from-amber-600 to-amber-800',
        primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
        activeNavTab: 'bg-amber-600 text-white shadow-amber-600/20',
        activeBadge: 'bg-amber-50 text-amber-800 border-amber-200',
        accentText: 'text-amber-600',
        accentBg: 'bg-amber-50',
        borderAccent: 'border-amber-300',
        ringAccent: 'focus:ring-amber-500',
      };
    case 'slate':
      return {
        brandGradient: 'from-slate-700 to-slate-900',
        primaryBtn: 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/20',
        activeNavTab: 'bg-slate-800 text-white shadow-slate-800/20',
        activeBadge: 'bg-slate-100 text-slate-800 border-slate-300',
        accentText: 'text-slate-800',
        accentBg: 'bg-slate-100',
        borderAccent: 'border-slate-400',
        ringAccent: 'focus:ring-slate-700',
      };
    case 'rose':
      return {
        brandGradient: 'from-rose-600 to-rose-800',
        primaryBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
        activeNavTab: 'bg-rose-600 text-white shadow-rose-600/20',
        activeBadge: 'bg-rose-50 text-rose-700 border-rose-200',
        accentText: 'text-rose-600',
        accentBg: 'bg-rose-50',
        borderAccent: 'border-rose-300',
        ringAccent: 'focus:ring-rose-500',
      };
    case 'indigo':
    default:
      return {
        brandGradient: 'from-indigo-600 to-indigo-800',
        primaryBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20',
        activeNavTab: 'bg-indigo-600 text-white shadow-indigo-600/20',
        activeBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
        accentText: 'text-indigo-600',
        accentBg: 'bg-indigo-50',
        borderAccent: 'border-indigo-300',
        ringAccent: 'focus:ring-indigo-500',
      };
  }
}
