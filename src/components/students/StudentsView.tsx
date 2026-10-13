import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { Student } from '../../types';
import { StudentCardModal } from './StudentCardModal';
import { BatchPrintStudentCardsModal } from './BatchPrintStudentCardsModal';
import {
  GraduationCap,
  Search,
  Plus,
  Printer,
  X,
  Edit2,
  Trash2,
  BookOpen,
  CheckCircle2,
  Clock,
  IdCard,
  School,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const StudentsView: React.FC = () => {
  const { students, loans, addStudent, updateStudent, deleteStudent, triggerScanFeedback, settings } = useLibrary();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('Tutti');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [isNewlyCreatedCard, setIsNewlyCreatedCard] = useState(false);
  const [isBatchPrintOpen, setIsBatchPrintOpen] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add student form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [classSection, setClassSection] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<Student['schoolLevel']>('Primaria');
  const [phoneParent, setPhoneParent] = useState('');
  const [emailParent, setEmailParent] = useState('');
  const [notes, setNotes] = useState('');

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (selectedLevel !== 'Tutti' && s.schoolLevel !== selectedLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${s.firstName} ${s.lastName}`.toLowerCase().includes(q);
      const matchReverse = `${s.lastName} ${s.firstName}`.toLowerCase().includes(q);
      const matchClass = s.classSection.toLowerCase().includes(q);
      const matchCode = s.studentCode.toLowerCase().includes(q);
      return matchName || matchReverse || matchClass || matchCode;
    }
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      triggerScanFeedback('error', 'Nome e cognome dello studente sono obbligatori.');
      return;
    }

    const nextCode = `ALU-${String(students.length + 1).padStart(4, '0')}`;
    const newStudent = addStudent({
      studentCode: nextCode,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      classSection: classSection.trim() || '1A',
      schoolLevel,
      phoneParent: phoneParent.trim() || undefined,
      emailParent: emailParent.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setFirstName('');
    setLastName('');
    setClassSection('');
    setPhoneParent('');
    setEmailParent('');
    setNotes('');
    setIsAddModalOpen(false);

    // Open the redesigned 80x50mm barcode card for instant printing
    setSelectedStudentForCard(newStudent);
    setIsNewlyCreatedCard(true);

    triggerScanFeedback('success', `Alunno ${newStudent.firstName} ${newStudent.lastName} registrato con tessera ${newStudent.studentCode}`);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    updateStudent(editingStudent.id, {
      firstName: editingStudent.firstName.trim(),
      lastName: editingStudent.lastName.trim(),
      classSection: editingStudent.classSection.trim(),
      schoolLevel: editingStudent.schoolLevel,
      phoneParent: editingStudent.phoneParent?.trim() || undefined,
      emailParent: editingStudent.emailParent?.trim() || undefined,
      notes: editingStudent.notes?.trim() || undefined,
    });

    setEditingStudent(null);
    triggerScanFeedback('success', 'Dati anagrafici studente aggiornati.');
  };

  const handleDelete = (s: Student) => {
    const activeLoans = loans.filter(
      (l) => l.studentId === s.id && (l.status === 'Attivo' || l.status === 'In Ritardo')
    );
    if (activeLoans.length > 0) {
      triggerScanFeedback('error', `Impossibile eliminare: l'alunno ha ${activeLoans.length} libri attualmente in prestito!`);
      return;
    }

    if (window.confirm(`Sei sicuro di voler eliminare lo studente ${s.firstName} ${s.lastName}?`)) {
      deleteStudent(s.id);
      triggerScanFeedback('info', `Studente ${s.firstName} ${s.lastName} eliminato.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <span>Anagrafica Alunni &amp; Tessere Biblioteca</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {students.length} iscritti
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generazione e stampa tessere lettore con barcode per scansione immediata (formato 80 x 50 mm)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsBatchPrintOpen(true)}
            disabled={students.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-xs"
            title="Stampa multipla tessere su foglio A4 o rotolo 80x50 mm"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            <span>Stampa Tessere (80x50)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuovo Alunno / Lettore</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per Nome, Cognome, Classe (es. 2B) o Codice tessera (ALU-0001)..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 text-slate-700"
          >
            <option value="Tutti">Tutti i gradi scolastici</option>
            <option value="Primaria">Scuola Primaria</option>
            <option value="Secondaria I grado">Secondaria I grado (Medie)</option>
            <option value="Docente / Personale">Docenti &amp; Personale</option>
          </select>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nessun alunno registrato</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            L&apos;anagrafica lettori è attualmente vuota. Registra gli studenti della scuola o importa
            un file CSV da Excel o Google Fogli.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Registra Primo Alunno</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
          Nessun alunno corrisponde ai criteri di ricerca.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const studentLoans = loans.filter((l) => l.studentId === student.id);
            const activeCount = studentLoans.filter(
              (l) => l.status === 'Attivo' || l.status === 'In Ritardo'
            ).length;
            const hasOverdue = studentLoans.some((l) => l.status === 'In Ritardo');

            return (
              <div
                key={student.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:border-indigo-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-extrabold flex items-center justify-center shadow-xs">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                          {student.lastName} {student.firstName}
                        </h4>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded border border-indigo-100">
                            Classe {student.classSection}
                          </span>
                          <span>• {student.schoolLevel}</span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {student.studentCode}
                    </span>
                  </div>

                  {/* Loan count pills */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Prestiti in corso:</span>
                    {activeCount > 0 ? (
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full ${
                          hasOverdue
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {activeCount} {activeCount === 1 ? 'libro' : 'libri'}{' '}
                        {hasOverdue && '(In Ritardo!)'}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium">Nessuno attivo</span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedStudentForCard(student);
                      setIsNewlyCreatedCard(false);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                    title="Mostra e stampa tessera con barcode (80x50 mm)"
                  >
                    <IdCard className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tessera 80x50</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                      title="Modifica dati"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(student)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Elimina studente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Student */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-lg">Iscrizione Nuovo Alunno</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Mario"
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cognome *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rossi"
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Classe / Sezione *
                  </label>
                  <input
                    type="text"
                    value={classSection}
                    onChange={(e) => setClassSection(e.target.value)}
                    placeholder="Es. 2B, 3A, 5C"
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grado</label>
                  <select
                    value={schoolLevel}
                    onChange={(e) => setSchoolLevel(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-xl bg-white"
                  >
                    <option value="Primaria">Primaria (Elementari)</option>
                    <option value="Secondaria I grado">Secondaria I grado (Medie)</option>
                    <option value="Docente / Personale">Docente / Personale</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefono Famiglia (opz.)
                  </label>
                  <input
                    type="tel"
                    value={phoneParent}
                    onChange={(e) => setPhoneParent(e.target.value)}
                    placeholder="333..."
                    className="w-full px-3 py-2 text-xs border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Famiglia (opz.)
                  </label>
                  <input
                    type="email"
                    value={emailParent}
                    onChange={(e) => setEmailParent(e.target.value)}
                    placeholder="genitore@..."
                    className="w-full px-3 py-2 text-xs border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20"
                >
                  Registra Alunno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Student */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Modifica Dati Alunno</h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={editingStudent.firstName}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={editingStudent.lastName}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Classe</label>
                  <input
                    type="text"
                    value={editingStudent.classSection}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, classSection: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Grado</label>
                  <select
                    value={editingStudent.schoolLevel}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        schoolLevel: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border rounded-xl bg-white"
                  >
                    <option value="Primaria">Primaria</option>
                    <option value="Secondaria I grado">Secondaria I grado</option>
                    <option value="Docente / Personale">Docente / Personale</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs text-slate-600"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redesigned 80x50 mm Student Card Modal */}
      {selectedStudentForCard && (
        <StudentCardModal
          student={selectedStudentForCard}
          isOpen={!!selectedStudentForCard}
          onClose={() => {
            setSelectedStudentForCard(null);
            setIsNewlyCreatedCard(false);
          }}
          isNewlyCreated={isNewlyCreatedCard}
        />
      )}

      {/* Batch Print Student Cards Modal (80x50 mm or A4 Sheet) */}
      {isBatchPrintOpen && (
        <BatchPrintStudentCardsModal
          students={filteredStudents}
          isOpen={isBatchPrintOpen}
          onClose={() => setIsBatchPrintOpen(false)}
        />
      )}
    </div>
  );
};
