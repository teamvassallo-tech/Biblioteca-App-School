import { Book, Student, Loan, AppSettings } from '../types';

export interface ExportDataPackage {
  app: string;
  version: string;
  exportedAt: string;
  settings: AppSettings;
  books: Book[];
  students: Student[];
  loans: Loan[];
}

/**
 * Escapes a cell for CSV formatting, handling commas, quotes, and newlines
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Trigger file download in browser with UTF-8 BOM support
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export complete backup package as JSON
 */
export function exportAllToJson(books: Book[], students: Student[], loans: Loan[], settings: AppSettings) {
  const dataPackage: ExportDataPackage = {
    app: 'BiblioScuola',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings,
    books,
    students,
    loans,
  };

  const jsonStr = JSON.stringify(dataPackage, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(jsonStr, `biblioscuola_backup_completo_${dateStr}.json`, 'application/json');
}

/**
 * Export Books Catalog as CSV (Compatible with Excel & Google Sheets via UTF-8 BOM)
 */
export function exportBooksToCsv(books: Book[]) {
  const BOM = '\uFEFF';
  const headers = [
    'Codice Inventario',
    'ISBN',
    'Titolo',
    'Autore/i',
    'Editore',
    'Anno',
    'Genere',
    'Fascia Età',
    'Collocazione',
    'Copie Totali',
    'Copie Disponibili',
    'Stato',
    'Pagine',
    'Sinossi',
    'URL Copertina',
  ];

  const rows = books.map((b) => [
    escapeCsvCell(b.inventoryCode),
    escapeCsvCell(b.isbn || ''),
    escapeCsvCell(b.title),
    escapeCsvCell((b.authors || []).join('; ')),
    escapeCsvCell(b.publisher || ''),
    escapeCsvCell(b.publicationYear || ''),
    escapeCsvCell(b.genre),
    escapeCsvCell(b.ageGroup),
    escapeCsvCell(b.collocazione),
    escapeCsvCell(b.copiesTotal),
    escapeCsvCell(b.copiesAvailable),
    escapeCsvCell(b.status),
    escapeCsvCell(b.pageCount || ''),
    escapeCsvCell(b.synopsis || ''),
    escapeCsvCell(b.coverUrl || ''),
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `biblioscuola_catalogo_libri_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export Loans Registry as CSV
 */
export function exportLoansToCsv(loans: Loan[]) {
  const BOM = '\uFEFF';
  const headers = [
    'ID Prestito',
    'Codice Libro',
    'Titolo Libro',
    'Codice Alunno',
    'Nome Alunno',
    'Classe',
    'Data Prestito',
    'Data Scadenza',
    'Data Restituzione',
    'Stato Prestito',
    'Proroghe Effettuate',
    'Note',
  ];

  const rows = loans.map((l) => [
    escapeCsvCell(l.id),
    escapeCsvCell(l.bookInventoryCode),
    escapeCsvCell(l.bookTitle),
    escapeCsvCell(l.studentCode),
    escapeCsvCell(l.studentName),
    escapeCsvCell(l.studentClass),
    escapeCsvCell(l.loanDate),
    escapeCsvCell(l.dueDate),
    escapeCsvCell(l.returnDate || ''),
    escapeCsvCell(l.status),
    escapeCsvCell(l.renewalsCount),
    escapeCsvCell(l.notes || ''),
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `biblioscuola_registro_prestiti_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Export Students as CSV
 */
export function exportStudentsToCsv(students: Student[]) {
  const BOM = '\uFEFF';
  const headers = [
    'Codice Alunno',
    'Cognome',
    'Nome',
    'Classe/Sezione',
    'Grado Scolastico',
    'Telefono Genitore',
    'Email',
    'Note',
  ];

  const rows = students.map((s) => [
    escapeCsvCell(s.studentCode),
    escapeCsvCell(s.lastName),
    escapeCsvCell(s.firstName),
    escapeCsvCell(s.classSection),
    escapeCsvCell(s.schoolLevel),
    escapeCsvCell(s.phoneParent || ''),
    escapeCsvCell(s.emailParent || ''),
    escapeCsvCell(s.notes || ''),
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `biblioscuola_anagrafica_alunni_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Robust CSV parser that handles quotes, multiline fields, and delimiters (, or ;)
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ''); // remove BOM
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  // Auto-detect delimiter on first line if needed
  let delimiter = ',';
  const firstLine = clean.split(/\r?\n/)[0] || '';
  if (firstLine.split(';').length > firstLine.split(',').length) {
    delimiter = ';';
  }

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}
