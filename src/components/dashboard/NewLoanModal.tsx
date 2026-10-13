import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Book, Student } from '../../types';
import { BookCoverImage } from '../catalog/BookCoverImage';
import {
  X,
  BookOpen,
  User,
  Calendar,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface NewLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedBook?: Book | null;
}

export const NewLoanModal: React.FC<NewLoanModalProps> = ({
  isOpen,
  onClose,
  preselectedBook,
}) => {
  const { books, students, settings, createLoan, addStudent, triggerScanFeedback } = useLibrary();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [durationDays, setDurationDays] = useState<number>(settings.defaultLoanDurationDays || 30);
  const [bookQuery, setBookQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');

  // Quick inline new student creation toggle
  const [isAddingNewStudent, setIsAddingNewStudent] = useState(false);
  const [newStudentFirst, setNewStudentFirst] = useState('');
  const [newStudentLast, setNewStudentLast] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newStudentLevel, setNewStudentLevel] = useState<'Primaria' | 'Secondaria I grado' | 'Docente / Personale'>('Primaria');

  useEffect(() => {
    if (preselectedBook) {
      setSelectedBook(preselectedBook);
    }
  }, [preselectedBook]);

  if (!isOpen) return null;

  // Filter available books
  const filteredBooks = books.filter((b) => {
    if (b.copiesAvailable <= 0) return false;
    if (!bookQuery.trim()) return true;
    const q = bookQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      (b.inventoryCode || '').toLowerCase().includes(q) ||
      (b.isbn || '').toLowerCase().includes(q) ||
      (b.authors || []).some((a) => a.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (!studentQuery.trim()) return true;
    const q = studentQuery.toLowerCase();
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      s.classSection.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const calculateDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + durationDays);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleQuickCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentFirst.trim() || !newStudentLast.trim()) {
      triggerScanFeedback('error', 'Inserisci nome e cognome dello studente.');
      return;
    }

    const studentCode = `ALU-${String(students.length + 1).padStart(4, '0')}`;
    const student = addStudent({
      studentCode,
      firstName: newStudentFirst.trim(),
      lastName: newStudentLast.trim(),
      classSection: newStudentClass.trim() || '1A',
      schoolLevel: newStudentLevel,
    });

    setSelectedStudent(student);
    setIsAddingNewStudent(false);
    setNewStudentFirst('');
    setNewStudentLast('');
    setNewStudentClass('');
    triggerScanFeedback('success', `Alunno ${student.firstName} ${student.lastName} registrato e selezionato!`);
  };

  const handleSubmitLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) {
      triggerScanFeedback('error', 'Seleziona un libro da prestare.');
      return;
    }
    if (!selectedStudent) {
      triggerScanFeedback('error', 'Seleziona o crea un alunno a cui assegnare il prestito.');
      return;
    }

    const res = createLoan(selectedBook.id, selectedStudent.id, durationDays);
    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-fadeIn">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Registra Nuovo Prestito</h3>
              <p className="text-xs text-slate-300">Assegna un libro a uno studente o docente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitLoan} className="p-6 space-y-6">
          {/* Step 1: Book Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              1. Libro da prestare
            </label>

            {selectedBook ? (
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded shadow-xs overflow-hidden shrink-0 bg-slate-900 flex items-center justify-center">
                    <BookCoverImage
                      coverUrl={selectedBook.coverUrl}
                      title={selectedBook.title}
                      authors={selectedBook.authors}
                      genre={selectedBook.genre}
                      isbn={selectedBook.isbn}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight">{selectedBook.title}</h4>
                    <p className="text-xs text-slate-600">
                      {(selectedBook.authors || []).join(', ') || 'Autore non specificato'}
                    </p>
                    <div className="text-[11px] text-indigo-700 font-mono mt-1">
                      Cod: {selectedBook.inventoryCode} • {selectedBook.collocazione}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBook(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-900 font-semibold px-2 py-1 rounded hover:bg-indigo-100 transition"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={bookQuery}
                    onChange={(e) => setBookQuery(e.target.value)}
                    placeholder="Cerca libro per titolo, autore, codice o ISBN..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                {books.length === 0 ? (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-sm">
                    Nessun libro a catalogo. Aggiungi prima dei libri nella sezione Catalogo!
                  </div>
                ) : filteredBooks.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Nessun libro disponibile trovato con questo filtro.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                    {filteredBooks.map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => setSelectedBook(book)}
                        className="w-full text-left p-2 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition flex items-center justify-between"
                      >
                        <div className="pr-2 truncate">
                          <span className="font-semibold text-xs text-slate-800 truncate block">
                            {book.title}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {(book.authors || []).join(', ')} • {book.inventoryCode}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                          {book.copiesAvailable} disp.
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Student Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                2. Alunno / Destinatario
              </label>
              {!isAddingNewStudent && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewStudent(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Nuovo Alunno al volo
                </button>
              )}
            </div>

            {isAddingNewStudent ? (
              <div className="p-4 rounded-xl border border-indigo-300 bg-indigo-50/40 space-y-3">
                <div className="text-xs font-bold text-indigo-900">
                  Registrazione rapida nuovo studente
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Nome *"
                    value={newStudentFirst}
                    onChange={(e) => setNewStudentFirst(e.target.value)}
                    className="p-2 text-xs border border-slate-300 rounded-lg bg-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Cognome *"
                    value={newStudentLast}
                    onChange={(e) => setNewStudentLast(e.target.value)}
                    className="p-2 text-xs border border-slate-300 rounded-lg bg-white"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Classe (es. 2B, 3A, 5C)"
                    value={newStudentClass}
                    onChange={(e) => setNewStudentClass(e.target.value)}
                    className="p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <select
                    value={newStudentLevel}
                    onChange={(e) => setNewStudentLevel(e.target.value as any)}
                    className="p-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Primaria">Scuola Primaria</option>
                    <option value="Secondaria I grado">Secondaria I grado (Medie)</option>
                    <option value="Docente / Personale">Docente / Personale</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewStudent(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateStudent}
                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    Salva e Seleziona
                  </button>
                </div>
              </div>
            ) : selectedStudent ? (
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                    {selectedStudent.firstName[0]}
                    {selectedStudent.lastName[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 leading-tight">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </h4>
                    <p className="text-xs text-slate-600">
                      Classe: <strong>{selectedStudent.classSection}</strong> • {selectedStudent.schoolLevel}
                    </p>
                    <div className="text-[11px] text-indigo-700 font-mono">
                      Tessera: {selectedStudent.studentCode}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-900 font-semibold px-2 py-1 rounded hover:bg-indigo-100 transition"
                >
                  Cambia
                </button>
              </div>
            ) : (
              <div>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Cerca studente per nome, cognome, classe (es. 2B) o codice tessera..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {students.length === 0 ? (
                  <div className="text-center p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 text-xs">
                    Nessun alunno presente in archivio. Clicca su &quot;+ Nuovo Alunno al volo&quot; qui sopra per registrarlo istantaneamente!
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500">
                    Nessun alunno trovato.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                    {filteredStudents.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudent(student)}
                        className="w-full text-left p-2 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-xs text-slate-800">
                            {student.firstName} {student.lastName}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            Classe: {student.classSection}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {student.studentCode}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Duration & Due Date */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Durata del prestito e Scadenza
              </label>
              <span className="text-xs font-bold text-indigo-700">
                Scadenza prevista: {calculateDueDate()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {[15, 30, 45, 60].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationDays(days)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                    durationDays === days
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {days} giorni
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!selectedBook || !selectedStudent}
              className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Conferma Prestito
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
