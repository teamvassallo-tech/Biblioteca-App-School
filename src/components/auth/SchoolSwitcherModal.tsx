import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import {
  School,
  Building2,
  Check,
  X,
  Plus,
  ArrowRight,
  ShieldCheck,
  LogOut,
  MapPin,
  Barcode,
} from 'lucide-react';
import { SchoolTenant } from '../../types';

interface SchoolSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SchoolSwitcherModal: React.FC<SchoolSwitcherModalProps> = ({ isOpen, onClose }) => {
  const {
    currentSchool,
    allSchools,
    currentUser,
    switchSchool,
    addSchool,
    logout,
    triggerScanFeedback,
  } = useLibrary();

  const [isAddingNewSchool, setIsAddingNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolId, setNewSchoolId] = useState('');
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newLibraryName, setNewLibraryName] = useState('');

  if (!isOpen) return null;

  const handleSelectSchool = (schoolId: string) => {
    switchSchool(schoolId);
    onClose();
  };

  const handleAddNewSchoolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) {
      triggerScanFeedback('error', 'Inserisci il nome della scuola.');
      return;
    }

    const cleanId = (newSchoolId || newSchoolName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');

    const createdSchool = addSchool({
      id: cleanId,
      code: newSchoolCode.trim().toUpperCase() || cleanId.toUpperCase(),
      name: newSchoolName.trim(),
      city: newCity.trim(),
      libraryName: newLibraryName.trim() || `Biblioteca ${newSchoolName.trim()}`,
    });

    switchSchool(createdSchool.id);
    setIsAddingNewSchool(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-white">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">Gestione Multi-Scuola (Tenant)</h3>
              <p className="text-xs text-indigo-200/80">
                Seleziona o aggiungi un istituto scolastico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Active School Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block mb-1">
              Scuola Attualmente Connessa
            </span>
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-sm font-extrabold text-indigo-950 block">
                  {currentSchool?.name}
                </strong>
                <span className="text-indigo-700">
                  School ID: <code className="font-mono font-bold">{currentSchool?.id}</code> • Codice:{' '}
                  {currentSchool?.code}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                <Check className="w-3.5 h-3.5" />
                <span>Attiva</span>
              </span>
            </div>
          </div>

          {/* School List */}
          {!isAddingNewSchool ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Istituti Registrati nel Sistema ({allSchools.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSchool(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuova Scuola</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {allSchools.map((school) => {
                  const isCurrent = school.id === currentSchool?.id;
                  return (
                    <div
                      key={school.id}
                      onClick={() => handleSelectSchool(school.id)}
                      className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'border-indigo-600 bg-indigo-50/40'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                          }`}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {school.name}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            School ID: <span className="font-mono font-medium">{school.id}</span>
                            {school.city ? ` • ${school.city}` : ''}
                          </p>
                        </div>
                      </div>

                      {isCurrent ? (
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                          In Uso
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg group-hover:text-indigo-700"
                        >
                          Passa a questa &rarr;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Add New School Form inside Modal */
            <form onSubmit={handleAddNewSchoolSubmit} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-xs text-slate-900">Registra una Nuova Scuola</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSchool(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Annulla
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Denominazione Scuola *
                </label>
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={(e) => {
                    setNewSchoolName(e.target.value);
                    if (!newSchoolId) {
                      setNewSchoolId(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '-')
                          .replace(/-+/g, '-')
                      );
                    }
                  }}
                  placeholder="Es. I.C. Rita Levi-Montalcini"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    School ID (univoco) *
                  </label>
                  <input
                    type="text"
                    value={newSchoolId}
                    onChange={(e) => setNewSchoolId(e.target.value.toLowerCase())}
                    placeholder="es. ic-montalcini"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Codice Meccanografico
                  </label>
                  <input
                    type="text"
                    value={newSchoolCode}
                    onChange={(e) => setNewSchoolCode(e.target.value.toUpperCase())}
                    placeholder="Es. RMIC801004"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Città
                  </label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    placeholder="Es. Roma"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Nome Biblioteca
                  </label>
                  <input
                    type="text"
                    value={newLibraryName}
                    onChange={(e) => setNewLibraryName(e.target.value)}
                    placeholder="Es. Biblioteca della Scienza"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs mt-1"
              >
                Crea Scuola e Attiva Tenant
              </button>
            </form>
          )}

          {/* User info & Disconnect */}
          {currentUser && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Utente connesso:</span>
                <span className="font-bold text-slate-800">
                  {currentUser.fullName} ({currentUser.email})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnetti</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
