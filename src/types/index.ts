export interface SchoolTenant {
  id: string; // Unique school ID / slug, e.g. "ic-erasmo"
  code: string; // Codice Meccanografico / Codice Univoco Scuola, es. "MIIC86900D"
  name: string; // Denominazione Ufficiale, es. "I.C. Erasmo da Rotterdam"
  city?: string; // Comune / Provincia
  libraryName?: string; // Nome della biblioteca scolastica
  address?: string;
  createdAt: string;
}

export type UserRole = 'docente' | 'bibliotecario' | 'amministratore' | 'collaboratore';

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: string; // Foreign key al SchoolTenant
  schoolName: string;
  password?: string;
  createdAt: string;
}

export interface Book {
  id: string;
  schoolId?: string; // Tenant School ID (per isolamento multi-scuola)
  inventoryCode: string; // Unique library internal code, e.g. "LIB-0001"
  isbn?: string; // Standard ISBN-10 or ISBN-13
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear?: string;
  genre: string;
  ageGroup: string;
  collocazione: string; // e.g. "Sede Centrale - Scaffale A2 - Ripiano 3"
  coverUrl?: string;
  synopsis?: string;
  copiesTotal: number;
  copiesAvailable: number;
  status: 'Disponibile' | 'In Prestito' | 'Riservato' | 'Danneggiato';
  pageCount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const GENRE_OPTIONS: string[] = [
  'Narrativa',
  'Avventura',
  'Fumetti & Manga',
  'Fiabe & Favole',
  'Scienza & Natura',
  'Storia & Biografie',
  'Giallo & Mistero',
  'Fantasy & Fantascienza',
  'Albi Illustrati',
  'Poesia & Teatro',
  'Classici della Letteratura',
  'Saggistica & Guide',
  'Altro'
];

export const AGE_GROUP_OPTIONS: string[] = [
  'Primaria (6-8 anni - 1ª/2ª)',
  'Primaria (8-11 anni - 3ª/5ª)',
  'Secondaria I grado (11-14 anni)',
  'Giovani Adulti (14+ anni)',
  'Docenti & Guide Didattiche'
];

export interface Student {
  id: string;
  schoolId?: string; // Tenant School ID
  studentCode: string; // Unique student card barcode, e.g. "ALU-0001"
  firstName: string;
  lastName: string;
  schoolLevel: 'Primaria' | 'Secondaria I grado' | 'Docente / Personale' | 'Altro';
  classSection: string; // e.g. "1A", "2B", "3C", "Docente"
  phoneParent?: string;
  emailParent?: string;
  notes?: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  schoolId?: string; // Tenant School ID
  bookId: string;
  bookTitle: string;
  bookInventoryCode: string;
  bookCoverUrl?: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  studentCode: string;
  loanDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD when returned
  status: 'Attivo' | 'In Ritardo' | 'Restituito';
  renewalsCount: number;
  notes?: string;
}

export type VisualLayoutPresetId =
  | 'standard'
  | 'lim_touch'
  | 'compact_desk'
  | 'sidebar_modern'
  | 'accessibility';

export type NavPosition = 'top' | 'sidebar';
export type ContentDensity = 'compact' | 'comfortable' | 'spacious';
export type ContentWidth = 'contained' | 'wide' | 'full';
export type ColorTheme = 'indigo' | 'emerald' | 'blue' | 'amber' | 'slate' | 'rose';
export type FontSize = 'normal' | 'large';

export interface VisualLayoutPreset {
  id: VisualLayoutPresetId;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  iconName: string;
  settings: {
    navPosition: NavPosition;
    contentDensity: ContentDensity;
    contentWidth: ContentWidth;
    colorTheme: ColorTheme;
    fontSize: FontSize;
  };
}

export interface AppSettings {
  schoolId?: string;
  libraryName: string;
  schoolName: string;
  defaultLoanDurationDays: number;
  soundEnabled: boolean;
  autoPrintReceipt?: boolean;
  // External Bibliographic Database credentials
  isbndbApiKey?: string;
  worldcatWskey?: string;
  librarythingDevKey?: string;
  // Visual Layout & Appearance Settings
  visualLayoutPreset?: VisualLayoutPresetId;
  navPosition?: NavPosition;
  contentDensity?: ContentDensity;
  contentWidth?: ContentWidth;
  colorTheme?: ColorTheme;
  fontSize?: FontSize;
}

export interface ScanFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export interface AiRecommendation {
  bookId: string;
  matchScore: number;
  reasoning: string;
}
