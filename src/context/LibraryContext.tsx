import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Book,
  Student,
  Loan,
  AppSettings,
  ScanFeedback,
  SchoolTenant,
  UserAccount,
  UserRole,
} from '../types';
import { playScanSuccess, playScanError, playReturnSuccess } from '../utils/audio';

export interface LibraryContextType {
  // Authentication & Multi-Tenant state
  currentUser: UserAccount | null;
  currentSchool: SchoolTenant | null;
  allSchools: SchoolTenant[];
  allUsers: UserAccount[];
  login: (credentials: { email: string; password?: string; schoolId: string }) => { success: boolean; message: string };
  register: (data: {
    fullName: string;
    email: string;
    password?: string;
    role: UserRole;
    schoolMode: 'existing' | 'new';
    schoolId: string;
    schoolName?: string;
    schoolCode?: string;
    city?: string;
    libraryName?: string;
  }) => { success: boolean; message: string };
  logout: () => void;
  switchSchool: (schoolId: string) => { success: boolean; message: string };
  addSchool: (schoolData: Omit<SchoolTenant, 'createdAt'>) => SchoolTenant;

  // Multi-tenant scoped Data (filtered strictly by currentSchool.id)
  books: Book[];
  students: Student[];
  loans: Loan[];
  settings: AppSettings;
  scanToast: ScanFeedback | null;
  clearScanToast: () => void;
  triggerScanFeedback: (type: 'success' | 'error' | 'info', message: string) => void;

  // Book actions (scoped to active school)
  addBook: (bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'schoolId'>) => Book;
  updateBook: (id: string, updates: Partial<Book>) => void;
  batchUpdateBooks: (updatesList: Array<{ id: string; changes: Partial<Book> }>) => void;
  deleteBook: (id: string) => void;
  findBookByCode: (code: string) => Book | undefined;

  // Student actions (scoped to active school)
  addStudent: (studentData: Omit<Student, 'id' | 'createdAt' | 'schoolId'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  findStudentByCodeOrName: (query: string) => Student | undefined;

  // Loan actions (scoped to active school)
  createLoan: (bookId: string, studentId: string, customDurationDays?: number) => { success: boolean; message: string; loan?: Loan };
  returnLoan: (loanId: string, notes?: string) => { success: boolean; message: string };
  returnLoanByBookCode: (bookCode: string) => { success: boolean; message: string; loan?: Loan };
  renewLoan: (loanId: string, daysToAdd?: number) => { success: boolean; message: string };

  // Settings & Reset
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetCurrentSchoolData: () => void;
  resetTotalSystem: () => void;

  // Import (scoped to active school)
  restoreDataPackage: (data: { books?: Book[]; students?: Student[]; loans?: Loan[]; settings?: AppSettings }, overwrite: boolean) => void;
}

const STORAGE_KEY_SCHOOLS = 'biblioscuola_schools_v2';
const STORAGE_KEY_USERS = 'biblioscuola_users_v2';
const STORAGE_KEY_CURRENT_USER = 'biblioscuola_current_user_v2';
const STORAGE_KEY_BOOKS = 'biblioscuola_books_v1';
const STORAGE_KEY_STUDENTS = 'biblioscuola_students_v1';
const STORAGE_KEY_LOANS = 'biblioscuola_loans_v1';
const STORAGE_KEY_SETTINGS_PREFIX = 'biblioscuola_settings_v2_';

const DEFAULT_SCHOOLS: SchoolTenant[] = [
  {
    id: 'ic-erasmo',
    code: 'MIIC86900D',
    name: 'I.C. Erasmo da Rotterdam',
    city: 'Cisliano (MI)',
    libraryName: 'Biblioteca Erasmo',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'ic-falcone',
    code: 'RMIC8A1002',
    name: 'I.C. Giovanni Falcone',
    city: 'Roma (RM)',
    libraryName: 'Biblioteca Falcone-Borsellino',
    createdAt: '2026-01-02T08:00:00.000Z',
  },
  {
    id: 'ic-da-vinci',
    code: 'NAIC8F3009',
    name: 'I.C. Leonardo da Vinci',
    city: 'Napoli (NA)',
    libraryName: 'Biblioteca Il Cenacolo',
    createdAt: '2026-01-03T08:00:00.000Z',
  },
];

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_erasmo_1',
    email: 'team.vassallo@icserasmo.edu.it',
    fullName: 'Fabrizio Vassallo',
    role: 'docente',
    schoolId: 'ic-erasmo',
    schoolName: 'I.C. Erasmo da Rotterdam',
    password: 'password',
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'usr_falcone_1',
    email: 'laura.conti@scuola.edu.it',
    fullName: 'Prof.ssa Laura Conti',
    role: 'bibliotecario',
    schoolId: 'ic-falcone',
    schoolName: 'I.C. Giovanni Falcone',
    password: 'password',
    createdAt: '2026-01-02T08:00:00.000Z',
  },
];

const buildDefaultSettings = (school?: SchoolTenant | null): AppSettings => ({
  schoolId: school?.id || 'ic-erasmo',
  libraryName: school?.libraryName || 'Biblioteca Scolastica',
  schoolName: school?.name || 'Istituto Comprensivo',
  defaultLoanDurationDays: 30,
  soundEnabled: true,
  autoPrintReceipt: false,
  visualLayoutPreset: 'standard',
  navPosition: 'top',
  contentDensity: 'comfortable',
  contentWidth: 'contained',
  colorTheme: 'indigo',
  fontSize: 'normal',
});

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Schools Repository
  const [allSchools, setAllSchools] = useState<SchoolTenant[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCHOOLS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Reconcile/patch school data in case old cached values (Binasco or outdated code) are present
          return parsed.map((s: SchoolTenant) => {
            if (s.id === 'ic-erasmo') {
              return {
                ...s,
                code: 'MIIC86900D',
                city: 'Cisliano (MI)',
              };
            }
            return s;
          });
        }
      }
    } catch {}
    return DEFAULT_SCHOOLS;
  });

  // 2. Users Repository
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Reconcile/patch user data to ensure teacher name is Fabrizio Vassallo (no Prof.)
          return parsed.map((u: UserAccount) => {
            if (
              u.email === 'team.vassallo@icserasmo.edu.it' ||
              u.id === 'usr_erasmo_1' ||
              (u.fullName && u.fullName.toLowerCase().includes('vassallo'))
            ) {
              return {
                ...u,
                fullName: 'Fabrizio Vassallo',
              };
            }
            return u;
          });
        }
      }
    } catch {}
    return DEFAULT_USERS;
  });

  // 3. Current Authenticated User Session
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.id && user.schoolId) {
          if (
            user.email === 'team.vassallo@icserasmo.edu.it' ||
            user.id === 'usr_erasmo_1' ||
            (user.fullName && user.fullName.toLowerCase().includes('vassallo'))
          ) {
            return {
              ...user,
              fullName: 'Fabrizio Vassallo',
            };
          }
          return user;
        }
      }
    } catch {}
    // Default to the user's account for immediate access if previously used
    return DEFAULT_USERS[0];
  });

  // Derive Current School from Current User
  const currentSchool = useMemo<SchoolTenant | null>(() => {
    if (!currentUser) return null;
    const found = allSchools.find((s) => s.id === currentUser.schoolId);
    if (found) return found;
    // Fallback if custom school ID
    return {
      id: currentUser.schoolId,
      code: currentUser.schoolId.toUpperCase(),
      name: currentUser.schoolName || 'Scuola',
      libraryName: 'Biblioteca Scolastica',
      createdAt: new Date().toISOString(),
    };
  }, [currentUser, allSchools]);

  // 4. Books Repository (global table, partitioned by schoolId)
  const [allBooks, setAllBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (saved) {
        const parsed: Book[] = JSON.parse(saved);
        // Backwards compatibility migration: tag unassigned books with ic-erasmo
        return parsed.map((b) => ({
          ...b,
          schoolId: b.schoolId || 'ic-erasmo',
        }));
      }
    } catch {}
    return [];
  });

  // 5. Students Repository (global table, partitioned by schoolId)
  const [allStudents, setAllStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STUDENTS);
      if (saved) {
        const parsed: Student[] = JSON.parse(saved);
        return parsed.map((s) => ({
          ...s,
          schoolId: s.schoolId || 'ic-erasmo',
        }));
      }
    } catch {}
    return [];
  });

  // 6. Loans Repository (global table, partitioned by schoolId)
  const [allLoans, setAllLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOANS);
      if (saved) {
        const parsed: Loan[] = JSON.parse(saved);
        return parsed.map((l) => ({
          ...l,
          schoolId: l.schoolId || 'ic-erasmo',
        }));
      }
    } catch {}
    return [];
  });

  // 7. Settings per School Tenant
  const [settings, setSettings] = useState<AppSettings>(() => {
    const initialSchoolId = currentUser?.schoolId || 'ic-erasmo';
    try {
      const key = `${STORAGE_KEY_SETTINGS_PREFIX}${initialSchoolId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...buildDefaultSettings(currentSchool), ...parsed, schoolId: initialSchoolId };
      }
    } catch {}
    return buildDefaultSettings(currentSchool);
  });

  const [scanToast, setScanToast] = useState<ScanFeedback | null>(null);

  // Sync Schools to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCHOOLS, JSON.stringify(allSchools));
  }, [allSchools]);

  // Sync Users to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(allUsers));
  }, [allUsers]);

  // Sync Current User Session to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  }, [currentUser]);

  // Reload School Settings when School changes
  useEffect(() => {
    if (!currentSchool) return;
    const key = `${STORAGE_KEY_SETTINGS_PREFIX}${currentSchool.id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...buildDefaultSettings(currentSchool), ...parsed, schoolId: currentSchool.id });
        return;
      }
    } catch {}
    setSettings(buildDefaultSettings(currentSchool));
  }, [currentSchool]);

  // Sync Current School Settings to LocalStorage
  useEffect(() => {
    if (!currentSchool) return;
    const key = `${STORAGE_KEY_SETTINGS_PREFIX}${currentSchool.id}`;
    localStorage.setItem(key, JSON.stringify(settings));
  }, [settings, currentSchool]);

  // Sync All Books to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(allBooks));
  }, [allBooks]);

  // Sync All Students to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(allStudents));
  }, [allStudents]);

  // Sync All Loans to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(allLoans));
  }, [allLoans]);

  // Toast & Audio helper
  const triggerScanFeedback = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (type === 'success') {
      playScanSuccess(settings.soundEnabled);
    } else if (type === 'error') {
      playScanError(settings.soundEnabled);
    }
    setScanToast({ type, message, timestamp: Date.now() });
  }, [settings.soundEnabled]);

  const clearScanToast = useCallback(() => {
    setScanToast(null);
  }, []);

  // Strict tenant filtering: Expose only data belonging to the connected user's school
  const activeSchoolId = currentSchool?.id || '';

  const scopedBooks = useMemo(() => {
    if (!activeSchoolId) return [];
    return allBooks.filter((b) => (b.schoolId || 'ic-erasmo') === activeSchoolId);
  }, [allBooks, activeSchoolId]);

  const scopedStudents = useMemo(() => {
    if (!activeSchoolId) return [];
    return allStudents.filter((s) => (s.schoolId || 'ic-erasmo') === activeSchoolId);
  }, [allStudents, activeSchoolId]);

  const scopedLoans = useMemo(() => {
    if (!activeSchoolId) return [];
    return allLoans.filter((l) => (l.schoolId || 'ic-erasmo') === activeSchoolId);
  }, [allLoans, activeSchoolId]);

  // Update loan overdue statuses for active school
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let changed = false;
    const updated = allLoans.map((loan) => {
      if (loan.status === 'Attivo' && loan.dueDate < today) {
        changed = true;
        return { ...loan, status: 'In Ritardo' as const };
      }
      return loan;
    });
    if (changed) {
      setAllLoans(updated);
    }
  }, [allLoans]);

  // ===================== AUTHENTICATION & MULTI-TENANT METHODS =====================

  const login = useCallback(
    ({ email, schoolId }: { email: string; password?: string; schoolId: string }) => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanSchoolId = schoolId.trim().toLowerCase();

      // Find the school
      let targetSchool = allSchools.find(
        (s) =>
          s.id.toLowerCase() === cleanSchoolId ||
          s.code.toLowerCase() === cleanSchoolId ||
          s.name.toLowerCase() === cleanSchoolId
      );

      if (!targetSchool) {
        // Auto-register school if custom ID entered
        targetSchool = {
          id: cleanSchoolId,
          code: cleanSchoolId.toUpperCase(),
          name: schoolId,
          libraryName: 'Biblioteca Scolastica',
          createdAt: new Date().toISOString(),
        };
        setAllSchools((prev) => [...prev, targetSchool!]);
      }

      // Find or create user account
      let user = allUsers.find(
        (u) => u.email.toLowerCase() === cleanEmail && u.schoolId === targetSchool!.id
      );

      if (!user) {
        // Create user for this school
        let formattedName = 'Operatore Biblioteca';
        if (cleanEmail === 'team.vassallo@icserasmo.edu.it') {
          formattedName = 'Fabrizio Vassallo';
        } else {
          const namePart = email.split('@')[0].replace(/[._]/g, ' ');
          formattedName = (namePart.charAt(0).toUpperCase() + namePart.slice(1)) || 'Operatore Biblioteca';
        }
        user = {
          id: `usr_${Date.now()}`,
          email: cleanEmail,
          fullName: formattedName,
          role: 'docente',
          schoolId: targetSchool.id,
          schoolName: targetSchool.name,
          createdAt: new Date().toISOString(),
        };
        setAllUsers((prev) => [...prev, user!]);
      } else if (
        user.email === 'team.vassallo@icserasmo.edu.it' ||
        (user.fullName && user.fullName.toLowerCase().includes('vassallo'))
      ) {
        if (user.fullName !== 'Fabrizio Vassallo') {
          user = { ...user, fullName: 'Fabrizio Vassallo' };
          setAllUsers((prev) =>
            prev.map((u) => (u.id === user!.id ? { ...u, fullName: 'Fabrizio Vassallo' } : u))
          );
        }
      }

      setCurrentUser(user);
      triggerScanFeedback('success', `Accesso effettuato per la scuola: ${targetSchool.name}`);
      return { success: true, message: 'Accesso eseguito con successo' };
    },
    [allSchools, allUsers, triggerScanFeedback]
  );

  const register = useCallback(
    (data: {
      fullName: string;
      email: string;
      password?: string;
      role: UserRole;
      schoolMode: 'existing' | 'new';
      schoolId: string;
      schoolName?: string;
      schoolCode?: string;
      city?: string;
      libraryName?: string;
    }) => {
      let finalSchool: SchoolTenant;

      if (data.schoolMode === 'new') {
        const cleanId = (data.schoolId || data.schoolName || 'scuola')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-');

        // Check if school ID exists, make unique if needed
        let uniqueId = cleanId;
        if (allSchools.some((s) => s.id === uniqueId)) {
          uniqueId = `${cleanId}-${Date.now().toString().slice(-4)}`;
        }

        finalSchool = {
          id: uniqueId,
          code: (data.schoolCode || uniqueId).trim().toUpperCase(),
          name: (data.schoolName || 'Nuova Scuola').trim(),
          city: data.city?.trim() || '',
          libraryName: data.libraryName?.trim() || `Biblioteca ${data.schoolName || 'Scolastica'}`,
          createdAt: new Date().toISOString(),
        };

        setAllSchools((prev) => [finalSchool, ...prev]);
      } else {
        const found = allSchools.find((s) => s.id === data.schoolId);
        if (!found) {
          return { success: false, message: 'Scuola selezionata non valida' };
        }
        finalSchool = found;
      }

      const newUser: UserAccount = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: data.email.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        role: data.role,
        schoolId: finalSchool.id,
        schoolName: finalSchool.name,
        password: data.password || 'password',
        createdAt: new Date().toISOString(),
      };

      setAllUsers((prev) => [newUser, ...prev]);
      setCurrentUser(newUser);

      triggerScanFeedback('success', `Benvenuto! Registrazione completata per: ${finalSchool.name}`);
      return { success: true, message: 'Registrazione completata con successo' };
    },
    [allSchools, triggerScanFeedback]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    triggerScanFeedback('info', 'Sessione terminata. Disconnessione effettuata.');
  }, [triggerScanFeedback]);

  const switchSchool = useCallback(
    (targetSchoolId: string) => {
      const targetSchool = allSchools.find((s) => s.id === targetSchoolId);
      if (!targetSchool) {
        return { success: false, message: 'Scuola non trovata' };
      }

      // Check if user already exists for this school or switch active school on current session
      if (currentUser) {
        const updatedUser: UserAccount = {
          ...currentUser,
          schoolId: targetSchool.id,
          schoolName: targetSchool.name,
        };
        setCurrentUser(updatedUser);
      } else {
        const demoUser: UserAccount = {
          id: `usr_${Date.now()}`,
          email: 'operatore@scuola.edu.it',
          fullName: 'Docente Biblioteca',
          role: 'docente',
          schoolId: targetSchool.id,
          schoolName: targetSchool.name,
          createdAt: new Date().toISOString(),
        };
        setCurrentUser(demoUser);
      }

      triggerScanFeedback('success', `Scuola attiva cambiata: "${targetSchool.name}" (ID: ${targetSchool.id})`);
      return { success: true, message: `Scuola attiva: ${targetSchool.name}` };
    },
    [allSchools, currentUser, triggerScanFeedback]
  );

  const addSchool = useCallback((schoolData: Omit<SchoolTenant, 'createdAt'>): SchoolTenant => {
    const newSchool: SchoolTenant = {
      ...schoolData,
      createdAt: new Date().toISOString(),
    };
    setAllSchools((prev) => [newSchool, ...prev]);
    return newSchool;
  }, []);

  // ===================== SCOPED BOOK ACTIONS =====================

  const findBookByCode = useCallback(
    (code: string): Book | undefined => {
      if (!code || !activeSchoolId) return undefined;
      const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return scopedBooks.find((b) => {
        const bInv = b.inventoryCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const bIsbn = (b.isbn || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const bId = b.id.toLowerCase();
        return bInv === clean || (bIsbn && bIsbn === clean) || bId === clean;
      });
    },
    [scopedBooks, activeSchoolId]
  );

  const addBook = useCallback(
    (bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'schoolId'>): Book => {
      const now = new Date().toISOString();
      const newBook: Book = {
        ...bookData,
        id: `lib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: activeSchoolId || 'ic-erasmo',
        createdAt: now,
        updatedAt: now,
      };
      setAllBooks((prev) => [newBook, ...prev]);
      return newBook;
    },
    [activeSchoolId]
  );

  const updateBook = useCallback(
    (id: string, updates: Partial<Book>) => {
      const now = new Date().toISOString();
      setAllBooks((prev) =>
        prev.map((b) =>
          b.id === id && (b.schoolId || 'ic-erasmo') === activeSchoolId
            ? { ...b, ...updates, updatedAt: now }
            : b
        )
      );
    },
    [activeSchoolId]
  );

  const batchUpdateBooks = useCallback(
    (updatesList: Array<{ id: string; changes: Partial<Book> }>) => {
      const map = new Map<string, Partial<Book>>();
      for (const item of updatesList) {
        map.set(item.id, item.changes);
      }
      const now = new Date().toISOString();
      setAllBooks((prev) =>
        prev.map((b) => {
          if ((b.schoolId || 'ic-erasmo') !== activeSchoolId) return b;
          const changes = map.get(b.id);
          if (!changes) return b;
          return { ...b, ...changes, updatedAt: now };
        })
      );
    },
    [activeSchoolId]
  );

  const deleteBook = useCallback(
    (id: string) => {
      setAllBooks((prev) =>
        prev.filter((b) => !(b.id === id && (b.schoolId || 'ic-erasmo') === activeSchoolId))
      );
    },
    [activeSchoolId]
  );

  // ===================== SCOPED STUDENT ACTIONS =====================

  const findStudentByCodeOrName = useCallback(
    (query: string): Student | undefined => {
      if (!query || !activeSchoolId) return undefined;
      const clean = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanName = query.trim().toLowerCase();
      return scopedStudents.find((s) => {
        const sCode = s.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sFullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const sReverseName = `${s.lastName} ${s.firstName}`.toLowerCase();
        return sCode === clean || sFullName === cleanName || sReverseName === cleanName;
      });
    },
    [scopedStudents, activeSchoolId]
  );

  const addStudent = useCallback(
    (studentData: Omit<Student, 'id' | 'createdAt' | 'schoolId'>): Student => {
      const newStudent: Student = {
        ...studentData,
        id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: activeSchoolId || 'ic-erasmo',
        createdAt: new Date().toISOString(),
      };
      setAllStudents((prev) => [newStudent, ...prev]);
      return newStudent;
    },
    [activeSchoolId]
  );

  const updateStudent = useCallback(
    (id: string, updates: Partial<Student>) => {
      setAllStudents((prev) =>
        prev.map((s) =>
          s.id === id && (s.schoolId || 'ic-erasmo') === activeSchoolId ? { ...s, ...updates } : s
        )
      );
    },
    [activeSchoolId]
  );

  const deleteStudent = useCallback(
    (id: string) => {
      setAllStudents((prev) =>
        prev.filter((s) => !(s.id === id && (s.schoolId || 'ic-erasmo') === activeSchoolId))
      );
    },
    [activeSchoolId]
  );

  // ===================== SCOPED LOAN ACTIONS =====================

  const createLoan = useCallback(
    (
      bookId: string,
      studentId: string,
      customDurationDays?: number
    ): { success: boolean; message: string; loan?: Loan } => {
      const book = scopedBooks.find((b) => b.id === bookId);
      if (!book) {
        triggerScanFeedback('error', 'Errore: Libro non trovato nel catalogo della scuola.');
        return { success: false, message: 'Libro non trovato' };
      }

      if (book.copiesAvailable <= 0 || book.status === 'In Prestito') {
        triggerScanFeedback('error', `Il libro "${book.title}" non ha copie disponibili al momento.`);
        return { success: false, message: 'Copie non disponibili' };
      }

      const student = scopedStudents.find((s) => s.id === studentId);
      if (!student) {
        triggerScanFeedback('error', 'Errore: Alunno non trovato nella scuola connessa.');
        return { success: false, message: 'Alunno non trovato' };
      }

      const durationDays = customDurationDays || settings.defaultLoanDurationDays || 30;
      const loanDateObj = new Date();
      const dueDateObj = new Date();
      dueDateObj.setDate(loanDateObj.getDate() + durationDays);

      const loanDate = loanDateObj.toISOString().slice(0, 10);
      const dueDate = dueDateObj.toISOString().slice(0, 10);

      const newLoan: Loan = {
        id: `pre_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        schoolId: activeSchoolId || 'ic-erasmo',
        bookId: book.id,
        bookTitle: book.title,
        bookInventoryCode: book.inventoryCode,
        bookCoverUrl: book.coverUrl,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentClass: student.classSection,
        studentCode: student.studentCode,
        loanDate,
        dueDate,
        status: 'Attivo',
        renewalsCount: 0,
      };

      // Update book availability
      const newCopiesAvailable = Math.max(0, book.copiesAvailable - 1);
      const newStatus = newCopiesAvailable === 0 ? 'In Prestito' : 'Disponibile';
      updateBook(book.id, {
        copiesAvailable: newCopiesAvailable,
        status: newStatus,
      });

      setAllLoans((prev) => [newLoan, ...prev]);

      triggerScanFeedback(
        'success',
        `Prestito registrato: "${book.title}" a ${student.firstName} ${student.lastName} (${student.classSection}) fino al ${dueDate}`
      );
      return { success: true, message: 'Prestito registrato con successo', loan: newLoan };
    },
    [scopedBooks, scopedStudents, settings.defaultLoanDurationDays, activeSchoolId, updateBook, triggerScanFeedback]
  );

  const returnLoan = useCallback(
    (loanId: string, notes?: string): { success: boolean; message: string } => {
      const loan = scopedLoans.find((l) => l.id === loanId);
      if (!loan) {
        triggerScanFeedback('error', 'Prestito non trovato per la scuola corrente.');
        return { success: false, message: 'Prestito non trovato' };
      }

      if (loan.status === 'Restituito') {
        triggerScanFeedback('info', 'Questo prestito è già stato contrassegnato come restituito.');
        return { success: false, message: 'Già restituito' };
      }

      const returnDate = new Date().toISOString().slice(0, 10);

      // Update loan
      setAllLoans((prev) =>
        prev.map((l) =>
          l.id === loanId && (l.schoolId || 'ic-erasmo') === activeSchoolId
            ? { ...l, returnDate, status: 'Restituito', notes: notes || l.notes }
            : l
        )
      );

      // Update book status and copiesAvailable
      const book = scopedBooks.find((b) => b.id === loan.bookId);
      if (book) {
        const newCopiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
        updateBook(book.id, {
          copiesAvailable: newCopiesAvailable,
          status: 'Disponibile',
        });
      }

      playReturnSuccess(settings.soundEnabled);
      triggerScanFeedback(
        'success',
        `Libro restituito con successo: "${loan.bookTitle}" riconsegnato da ${loan.studentName}!`
      );
      return { success: true, message: 'Libro restituito con successo' };
    },
    [scopedLoans, scopedBooks, activeSchoolId, settings.soundEnabled, updateBook, triggerScanFeedback]
  );

  const returnLoanByBookCode = useCallback(
    (bookCode: string): { success: boolean; message: string; loan?: Loan } => {
      const book = findBookByCode(bookCode);
      if (!book) {
        triggerScanFeedback('error', `Nessun libro trovato con codice/ISBN: "${bookCode}" per questa scuola.`);
        return { success: false, message: 'Libro non trovato' };
      }

      // Find the active or overdue loan for this book in this school
      const activeLoan = scopedLoans.find(
        (l) => l.bookId === book.id && (l.status === 'Attivo' || l.status === 'In Ritardo')
      );

      if (!activeLoan) {
        triggerScanFeedback(
          'error',
          `Il libro "${book.title}" (${book.inventoryCode}) risulta già disponibile a scaffale.`
        );
        return { success: false, message: 'Nessun prestito attivo per questo libro' };
      }

      const res = returnLoan(activeLoan.id);
      return { ...res, loan: activeLoan };
    },
    [findBookByCode, scopedLoans, returnLoan, triggerScanFeedback]
  );

  const renewLoan = useCallback(
    (loanId: string, daysToAdd: number = 15): { success: boolean; message: string } => {
      const loan = scopedLoans.find((l) => l.id === loanId);
      if (!loan) return { success: false, message: 'Prestito non trovato per la scuola corrente' };

      const currentDue = new Date(loan.dueDate);
      currentDue.setDate(currentDue.getDate() + daysToAdd);
      const newDueDate = currentDue.toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);

      setAllLoans((prev) =>
        prev.map((l) =>
          l.id === loanId && (l.schoolId || 'ic-erasmo') === activeSchoolId
            ? {
                ...l,
                dueDate: newDueDate,
                status: newDueDate >= today ? 'Attivo' : 'In Ritardo',
                renewalsCount: (l.renewalsCount || 0) + 1,
              }
            : l
        )
      );

      triggerScanFeedback(
        'success',
        `Proroga di ${daysToAdd} giorni accordata per "${loan.bookTitle}". Nuova scadenza: ${newDueDate}`
      );
      return { success: true, message: `Scadenza prorogata al ${newDueDate}` };
    },
    [scopedLoans, activeSchoolId, triggerScanFeedback]
  );

  // ===================== SETTINGS & RESETS =====================

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Safe Reset for Current School only (Leaves other schools untouched)
  const resetCurrentSchoolData = useCallback(() => {
    if (!activeSchoolId) return;

    setAllBooks((prev) => prev.filter((b) => (b.schoolId || 'ic-erasmo') !== activeSchoolId));
    setAllStudents((prev) => prev.filter((s) => (s.schoolId || 'ic-erasmo') !== activeSchoolId));
    setAllLoans((prev) => prev.filter((l) => (l.schoolId || 'ic-erasmo') !== activeSchoolId));

    triggerScanFeedback(
      'info',
      `Archivio della scuola "${currentSchool?.name || activeSchoolId}" azzerato. I dati delle altre scuole sono preservati.`
    );
  }, [activeSchoolId, currentSchool, triggerScanFeedback]);

  // Total System Reset
  const resetTotalSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_BOOKS);
    localStorage.removeItem(STORAGE_KEY_STUDENTS);
    localStorage.removeItem(STORAGE_KEY_LOANS);

    for (const s of allSchools) {
      localStorage.removeItem(`${STORAGE_KEY_SETTINGS_PREFIX}${s.id}`);
    }

    setAllBooks([]);
    setAllStudents([]);
    setAllLoans([]);
    setSettings(buildDefaultSettings(currentSchool));

    triggerScanFeedback('info', 'Reset totale effettuato su tutti gli archivi del sistema.');
  }, [allSchools, currentSchool, triggerScanFeedback]);

  // Import / Restore package scoped to active school
  const restoreDataPackage = useCallback(
    (
      data: { books?: Book[]; students?: Student[]; loans?: Loan[]; settings?: AppSettings },
      overwrite: boolean
    ) => {
      const targetSchoolId = activeSchoolId || 'ic-erasmo';

      if (overwrite) {
        // Remove only this school's items and replace
        const newBooks = (data.books || []).map((b) => ({ ...b, schoolId: targetSchoolId }));
        const newStudents = (data.students || []).map((s) => ({ ...s, schoolId: targetSchoolId }));
        const newLoans = (data.loans || []).map((l) => ({ ...l, schoolId: targetSchoolId }));

        setAllBooks((prev) => [
          ...prev.filter((b) => (b.schoolId || 'ic-erasmo') !== targetSchoolId),
          ...newBooks,
        ]);
        setAllStudents((prev) => [
          ...prev.filter((s) => (s.schoolId || 'ic-erasmo') !== targetSchoolId),
          ...newStudents,
        ]);
        setAllLoans((prev) => [
          ...prev.filter((l) => (l.schoolId || 'ic-erasmo') !== targetSchoolId),
          ...newLoans,
        ]);

        if (data.settings) {
          setSettings({ ...buildDefaultSettings(currentSchool), ...data.settings, schoolId: targetSchoolId });
        }
      } else {
        if (data.books && data.books.length > 0) {
          const toAdd = data.books.map((b) => ({
            ...b,
            schoolId: targetSchoolId,
            id: b.id.includes(targetSchoolId) ? b.id : `${b.id}_${targetSchoolId}`,
          }));
          setAllBooks((prev) => {
            const existingIds = new Set(prev.map((b) => b.id));
            const filtered = toAdd.filter((b) => !existingIds.has(b.id));
            return [...prev, ...filtered];
          });
        }
        if (data.students && data.students.length > 0) {
          const toAdd = data.students.map((s) => ({
            ...s,
            schoolId: targetSchoolId,
            id: s.id.includes(targetSchoolId) ? s.id : `${s.id}_${targetSchoolId}`,
          }));
          setAllStudents((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const filtered = toAdd.filter((s) => !existingIds.has(s.id));
            return [...prev, ...filtered];
          });
        }
        if (data.loans && data.loans.length > 0) {
          const toAdd = data.loans.map((l) => ({
            ...l,
            schoolId: targetSchoolId,
            id: l.id.includes(targetSchoolId) ? l.id : `${l.id}_${targetSchoolId}`,
          }));
          setAllLoans((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const filtered = toAdd.filter((l) => !existingIds.has(l.id));
            return [...prev, ...filtered];
          });
        }
      }
      triggerScanFeedback('success', `Dati importati per la scuola: ${currentSchool?.name || targetSchoolId}!`);
    },
    [activeSchoolId, currentSchool, triggerScanFeedback]
  );

  return (
    <LibraryContext.Provider
      value={{
        currentUser,
        currentSchool,
        allSchools,
        allUsers,
        login,
        register,
        logout,
        switchSchool,
        addSchool,
        books: scopedBooks,
        students: scopedStudents,
        loans: scopedLoans,
        settings,
        scanToast,
        clearScanToast,
        triggerScanFeedback,
        addBook,
        updateBook,
        batchUpdateBooks,
        deleteBook,
        findBookByCode,
        addStudent,
        updateStudent,
        deleteStudent,
        findStudentByCodeOrName,
        createLoan,
        returnLoan,
        returnLoanByBookCode,
        renewLoan,
        updateSettings,
        resetCurrentSchoolData,
        resetTotalSystem,
        restoreDataPackage,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
}
