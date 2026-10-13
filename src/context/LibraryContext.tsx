import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Book, Student, Loan, AppSettings, ScanFeedback } from '../types';
import { playScanSuccess, playScanError, playReturnSuccess } from '../utils/audio';

interface LibraryContextType {
  books: Book[];
  students: Student[];
  loans: Loan[];
  settings: AppSettings;
  scanToast: ScanFeedback | null;
  clearScanToast: () => void;
  triggerScanFeedback: (type: 'success' | 'error' | 'info', message: string) => void;
  // Book actions
  addBook: (bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) => Book;
  updateBook: (id: string, updates: Partial<Book>) => void;
  batchUpdateBooks: (updatesList: Array<{ id: string; changes: Partial<Book> }>) => void;
  deleteBook: (id: string) => void;
  findBookByCode: (code: string) => Book | undefined;
  // Student actions
  addStudent: (studentData: Omit<Student, 'id' | 'createdAt'>) => Student;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  findStudentByCodeOrName: (query: string) => Student | undefined;
  // Loan actions
  createLoan: (bookId: string, studentId: string, customDurationDays?: number) => { success: boolean; message: string; loan?: Loan };
  returnLoan: (loanId: string, notes?: string) => { success: boolean; message: string };
  returnLoanByBookCode: (bookCode: string) => { success: boolean; message: string; loan?: Loan };
  renewLoan: (loanId: string, daysToAdd?: number) => { success: boolean; message: string };
  // Settings & Reset
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  resetTotalSystem: () => void;
  // Import
  restoreDataPackage: (data: { books?: Book[]; students?: Student[]; loans?: Loan[]; settings?: AppSettings }, overwrite: boolean) => void;
}

const STORAGE_KEY_BOOKS = 'biblioscuola_books_v1';
const STORAGE_KEY_STUDENTS = 'biblioscuola_students_v1';
const STORAGE_KEY_LOANS = 'biblioscuola_loans_v1';
const STORAGE_KEY_SETTINGS = 'biblioscuola_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  libraryName: 'Biblioteca Scolastica',
  schoolName: 'Istituto Comprensivo',
  defaultLoanDurationDays: 30,
  soundEnabled: true,
  autoPrintReceipt: false,
  visualLayoutPreset: 'standard',
  navPosition: 'top',
  contentDensity: 'comfortable',
  contentWidth: 'contained',
  colorTheme: 'indigo',
  fontSize: 'normal',
};

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // CRITICAL REQUIREMENT: Initial state must be completely EMPTY array []. Zero sample/demo data!
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOOKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STUDENTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loans, setLoans] = useState<Loan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOANS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [scanToast, setScanToast] = useState<ScanFeedback | null>(null);

  // Sync with LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOANS, JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

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

  // Update loan overdue statuses based on today's date
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let changed = false;
    const updated = loans.map((loan) => {
      if (loan.status === 'Attivo' && loan.dueDate < today) {
        changed = true;
        return { ...loan, status: 'In Ritardo' as const };
      }
      return loan;
    });
    if (changed) {
      setLoans(updated);
    }
  }, [loans]);

  // Find book by Inventory Code or ISBN (ignores case and dashes)
  const findBookByCode = useCallback((code: string): Book | undefined => {
    if (!code) return undefined;
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return books.find((b) => {
      const bInv = b.inventoryCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bIsbn = (b.isbn || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const bId = b.id.toLowerCase();
      return bInv === clean || (bIsbn && bIsbn === clean) || bId === clean;
    });
  }, [books]);

  // Find student by code or full name
  const findStudentByCodeOrName = useCallback((query: string): Student | undefined => {
    if (!query) return undefined;
    const clean = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanName = query.trim().toLowerCase();
    return students.find((s) => {
      const sCode = s.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sFullName = `${s.firstName} ${s.lastName}`.toLowerCase();
      const sReverseName = `${s.lastName} ${s.firstName}`.toLowerCase();
      return sCode === clean || sFullName === cleanName || sReverseName === cleanName;
    });
  }, [students]);

  // Book actions
  const addBook = useCallback((bookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Book => {
    const now = new Date().toISOString();
    const newBook: Book = {
      ...bookData,
      id: `lib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setBooks((prev) => [newBook, ...prev]);
    return newBook;
  }, []);

  const updateBook = useCallback((id: string, updates: Partial<Book>) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b))
    );
  }, []);

  const batchUpdateBooks = useCallback((updatesList: Array<{ id: string; changes: Partial<Book> }>) => {
    const map = new Map<string, Partial<Book>>();
    for (const item of updatesList) {
      map.set(item.id, item.changes);
    }
    const now = new Date().toISOString();
    setBooks((prev) =>
      prev.map((b) => {
        const changes = map.get(b.id);
        if (!changes) return b;
        return { ...b, ...changes, updatedAt: now };
      })
    );
  }, []);

  const deleteBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  // Student actions
  const addStudent = useCallback((studentData: Omit<Student, 'id' | 'createdAt'>): Student => {
    const newStudent: Student = {
      ...studentData,
      id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setStudents((prev) => [newStudent, ...prev]);
    return newStudent;
  }, []);

  const updateStudent = useCallback((id: string, updates: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Loan actions
  const createLoan = useCallback((
    bookId: string,
    studentId: string,
    customDurationDays?: number
  ): { success: boolean; message: string; loan?: Loan } => {
    const book = books.find((b) => b.id === bookId);
    if (!book) {
      triggerScanFeedback('error', 'Errore: Libro non trovato nel catalogo.');
      return { success: false, message: 'Libro non trovato' };
    }

    if (book.copiesAvailable <= 0 || book.status === 'In Prestito') {
      triggerScanFeedback('error', `Il libro "${book.title}" non ha copie disponibili al momento.`);
      return { success: false, message: 'Copie non disponibili' };
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) {
      triggerScanFeedback('error', 'Errore: Alunno non selezionato o non registrato.');
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

    setLoans((prev) => [newLoan, ...prev]);

    triggerScanFeedback('success', `Prestito registrato: "${book.title}" a ${student.firstName} ${student.lastName} (${student.classSection}) fino al ${dueDate}`);
    return { success: true, message: 'Prestito registrato con successo', loan: newLoan };
  }, [books, students, settings.defaultLoanDurationDays, updateBook, triggerScanFeedback]);

  // Return Loan by ID
  const returnLoan = useCallback((loanId: string, notes?: string): { success: boolean; message: string } => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) {
      triggerScanFeedback('error', 'Prestito non trovato.');
      return { success: false, message: 'Prestito non trovato' };
    }

    if (loan.status === 'Restituito') {
      triggerScanFeedback('info', 'Questo prestito è già stato contrassegnato come restituito.');
      return { success: false, message: 'Già restituito' };
    }

    const returnDate = new Date().toISOString().slice(0, 10);

    // Update loan
    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? { ...l, returnDate, status: 'Restituito', notes: notes || l.notes }
          : l
      )
    );

    // Update book status and copiesAvailable
    const book = books.find((b) => b.id === loan.bookId);
    if (book) {
      const newCopiesAvailable = Math.min(book.copiesTotal, book.copiesAvailable + 1);
      updateBook(book.id, {
        copiesAvailable: newCopiesAvailable,
        status: 'Disponibile',
      });
    }

    playReturnSuccess(settings.soundEnabled);
    triggerScanFeedback('success', `Libro restituito con successo: "${loan.bookTitle}" riconsegnato da ${loan.studentName}!`);
    return { success: true, message: 'Libro restituito con successo' };
  }, [loans, books, settings.soundEnabled, updateBook, triggerScanFeedback]);

  // Scan & Go Fast Return by scanning book barcode/ISBN
  const returnLoanByBookCode = useCallback((bookCode: string): { success: boolean; message: string; loan?: Loan } => {
    const book = findBookByCode(bookCode);
    if (!book) {
      triggerScanFeedback('error', `Nessun libro trovato con codice/ISBN: "${bookCode}"`);
      return { success: false, message: 'Libro non trovato' };
    }

    // Find the active or overdue loan for this book
    const activeLoan = loans.find(
      (l) => l.bookId === book.id && (l.status === 'Attivo' || l.status === 'In Ritardo')
    );

    if (!activeLoan) {
      triggerScanFeedback('error', `Il libro "${book.title}" (${book.inventoryCode}) risulta già disponibile a scaffale (nessun prestito attivo registrato).`);
      return { success: false, message: 'Nessun prestito attivo per questo libro' };
    }

    const res = returnLoan(activeLoan.id);
    return { ...res, loan: activeLoan };
  }, [findBookByCode, loans, returnLoan, triggerScanFeedback]);

  // Renew loan
  const renewLoan = useCallback((loanId: string, daysToAdd: number = 15): { success: boolean; message: string } => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return { success: false, message: 'Prestito non trovato' };

    const currentDue = new Date(loan.dueDate);
    currentDue.setDate(currentDue.getDate() + daysToAdd);
    const newDueDate = currentDue.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    setLoans((prev) =>
      prev.map((l) =>
        l.id === loanId
          ? {
              ...l,
              dueDate: newDueDate,
              status: newDueDate >= today ? 'Attivo' : 'In Ritardo',
              renewalsCount: (l.renewalsCount || 0) + 1,
            }
          : l
      )
    );

    triggerScanFeedback('success', `Proroga di ${daysToAdd} giorni accordata per "${loan.bookTitle}". Nuova scadenza: ${newDueDate}`);
    return { success: true, message: `Scadenza prorogata al ${newDueDate}` };
  }, [loans, triggerScanFeedback]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // CRITICAL REQUIREMENT: Reset Totale Sistema
  const resetTotalSystem = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_BOOKS);
    localStorage.removeItem(STORAGE_KEY_STUDENTS);
    localStorage.removeItem(STORAGE_KEY_LOANS);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);

    setBooks([]);
    setStudents([]);
    setLoans([]);
    setSettings(DEFAULT_SETTINGS);

    triggerScanFeedback('info', 'Sistema azzerato completamente. Tutti gli archivi sono ora vuoti.');
  }, [triggerScanFeedback]);

  // Import / Restore package
  const restoreDataPackage = useCallback((
    data: { books?: Book[]; students?: Student[]; loans?: Loan[]; settings?: AppSettings },
    overwrite: boolean
  ) => {
    if (overwrite) {
      setBooks(data.books || []);
      setStudents(data.students || []);
      setLoans(data.loans || []);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    } else {
      if (data.books && data.books.length > 0) {
        setBooks((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const toAdd = data.books!.filter((b) => !existingIds.has(b.id));
          return [...prev, ...toAdd];
        });
      }
      if (data.students && data.students.length > 0) {
        setStudents((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const toAdd = data.students!.filter((s) => !existingIds.has(s.id));
          return [...prev, ...toAdd];
        });
      }
      if (data.loans && data.loans.length > 0) {
        setLoans((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const toAdd = data.loans!.filter((l) => !existingIds.has(l.id));
          return [...prev, ...toAdd];
        });
      }
    }
    triggerScanFeedback('success', 'Dati importati con successo!');
  }, [triggerScanFeedback]);

  return (
    <LibraryContext.Provider
      value={{
        books,
        students,
        loans,
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
