import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import {
  BookOpen,
  School,
  Building2,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  PlusCircle,
  LogIn,
  KeyRound,
  MapPin,
  Barcode,
} from 'lucide-react';
import { UserRole } from '../../types';

export const AuthScreen: React.FC = () => {
  const { allSchools, login, register, triggerScanFeedback } = useLibrary();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('team.vassallo@icserasmo.edu.it');
  const [loginPassword, setLoginPassword] = useState('password');
  const [selectedSchoolId, setSelectedSchoolId] = useState(allSchools[0]?.id || 'ic-erasmo');
  const [customSchoolId, setCustomSchoolId] = useState('');
  const [isUsingCustomSchoolId, setIsUsingCustomSchoolId] = useState(false);

  // Register Form State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('docente');
  const [regSchoolMode, setRegSchoolMode] = useState<'existing' | 'new'>('existing');
  const [regExistingSchoolId, setRegExistingSchoolId] = useState(allSchools[0]?.id || 'ic-erasmo');
  const [regNewSchoolName, setRegNewSchoolName] = useState('');
  const [regNewSchoolId, setRegNewSchoolId] = useState('');
  const [regNewSchoolCode, setRegNewSchoolCode] = useState('');
  const [regNewCity, setRegNewCity] = useState('');
  const [regNewLibraryName, setRegNewLibraryName] = useState('');

  // Handle auto-generation of slug when typing new school name
  const handleNewSchoolNameChange = (val: string) => {
    setRegNewSchoolName(val);
    if (!regNewSchoolId || regNewSchoolId.startsWith('scuola-') || regNewSchoolId.includes('-')) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setRegNewSchoolId(slug || 'scuola');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveSchoolId = isUsingCustomSchoolId ? customSchoolId.trim() : selectedSchoolId;
    if (!effectiveSchoolId) {
      triggerScanFeedback('error', 'Seleziona o inserisci lo School ID della tua scuola.');
      return;
    }

    const res = login({
      email: loginEmail,
      password: loginPassword,
      schoolId: effectiveSchoolId,
    });

    if (!res.success) {
      triggerScanFeedback('error', res.message);
    }
  };

  const handleQuickDemoLogin = (schoolId: string, email: string) => {
    login({
      email,
      password: 'password',
      schoolId,
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFullName.trim() || !regEmail.trim()) {
      triggerScanFeedback('error', 'Compila nome e indirizzo email.');
      return;
    }

    if (regSchoolMode === 'new') {
      if (!regNewSchoolName.trim()) {
        triggerScanFeedback('error', 'Inserisci la denominazione ufficiale della nuova scuola.');
        return;
      }
      const schoolId = regNewSchoolId.trim().toLowerCase() || 'scuola';
      register({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        schoolMode: 'new',
        schoolId,
        schoolName: regNewSchoolName.trim(),
        schoolCode: regNewSchoolCode.trim().toUpperCase(),
        city: regNewCity.trim(),
        libraryName: regNewLibraryName.trim() || `Biblioteca ${regNewSchoolName.trim()}`,
      });
    } else {
      register({
        fullName: regFullName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        schoolMode: 'existing',
        schoolId: regExistingSchoolId,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans">
      {/* Background ambient decorative glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/25 mb-1">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            BiblioScuola
          </h1>
          <p className="text-sm text-indigo-200/80 max-w-md mx-auto">
            Sistema Gestionale Biblioteca Scolastica • <strong>Multi-Tenant (Multi-Scuola)</strong>
          </p>

          {/* Multi-Tenant Security Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-900/60 border border-indigo-500/30 text-xs text-indigo-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Isolamento rigoroso dei dati per istituto (School ID)</span>
          </div>
        </div>

        {/* Auth Box Container */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Navigation Tabs (Accedi / Registrati) */}
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Accedi alla tua Scuola</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrati / Nuova Scuola</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {/* ======================= TAB 1: LOGIN ======================= */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                {/* School Selector (Multi-Tenant requirement) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <School className="w-4 h-4 text-indigo-600" />
                      <span>Seleziona la tua Scuola (School ID) *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsUsingCustomSchoolId(!isUsingCustomSchoolId)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      {isUsingCustomSchoolId ? 'Scegli da elenco' : 'Inserisci ID manuale'}
                    </button>
                  </div>

                  {!isUsingCustomSchoolId ? (
                    <div className="space-y-2">
                      <select
                        value={selectedSchoolId}
                        onChange={(e) => setSelectedSchoolId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
                      >
                        {allSchools.map((school) => (
                          <option key={school.id} value={school.id}>
                            {school.name} ({school.code ? `${school.code} - ` : ''}ID: {school.id})
                          </option>
                        ))}
                      </select>

                      {/* Display details of selected school */}
                      {(() => {
                        const cur = allSchools.find((s) => s.id === selectedSchoolId);
                        if (!cur) return null;
                        return (
                          <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                              <div>
                                <span className="font-bold block">{cur.name}</span>
                                <span className="text-[11px] text-indigo-700">
                                  {cur.city || 'Sede'} • Codice: {cur.code} • {cur.libraryName}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-indigo-800 font-bold border border-indigo-200">
                              {cur.id}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={customSchoolId}
                        onChange={(e) => setCustomSchoolId(e.target.value)}
                        placeholder="Es. ic-erasmo o MIIC86900D"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Inserisci il codice identificativo univoco (School ID o Codice Meccanografico) fornito dal tuo istituto.
                      </span>
                    </div>
                  )}
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span>Email Istituzionale o Personale *</span>
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="es. nome.cognome@scuola.edu.it"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Password</span>
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>Accedi alla Biblioteca Scolastica</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Quick 1-Click Demo Buttons for Fast Evaluation of Multi-Tenancy */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block text-center">
                    Oppure prova subito una scuola dimostrativa:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickDemoLogin('ic-erasmo', 'team.vassallo@icserasmo.edu.it')
                      }
                      className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70 text-left transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-indigo-900 block truncate">
                          I.C. Erasmo da Rotterdam
                        </span>
                        <span className="text-[10px] text-indigo-600 block">ID: ic-erasmo</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 group-hover:translate-x-0.5 transition" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuickDemoLogin('ic-falcone', 'laura.conti@scuola.edu.it')
                      }
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition cursor-pointer flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 block truncate">
                          I.C. Giovanni Falcone
                        </span>
                        <span className="text-[10px] text-slate-500 block">ID: ic-falcone</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ======================= TAB 2: REGISTER ======================= */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Full Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Nome e Cognome *</span>
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="Es. Prof. Marco Rossi"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>Email Istituzionale *</span>
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="es. m.rossi@scuola.edu.it"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Role and Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800">Ruolo Scolastico</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="docente">Docente / Referente Biblioteca</option>
                      <option value="bibliotecario">Bibliotecario Scolastico</option>
                      <option value="collaboratore">Personale ATA / Collaboratore</option>
                      <option value="amministratore">Dirigente / Amministratore</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Password</span>
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Crea una password"
                      className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* School Tenant Choice */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <label className="text-xs font-bold text-slate-900 block">
                    Scuola di Appartenenza (Multi-Tenant):
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      onClick={() => setRegSchoolMode('existing')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        regSchoolMode === 'existing'
                          ? 'border-indigo-600 bg-indigo-50/40'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={regSchoolMode === 'existing'}
                        onChange={() => setRegSchoolMode('existing')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          Unisciti a scuola esistente
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Se la scuola è già registrata nel sistema
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setRegSchoolMode('new')}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        regSchoolMode === 'new'
                          ? 'border-indigo-600 bg-indigo-50/40'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={regSchoolMode === 'new'}
                        onChange={() => setRegSchoolMode('new')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                          Registra una NUOVA Scuola
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Crea un nuovo tenant isolato
                        </span>
                      </div>
                    </label>
                  </div>

                  {regSchoolMode === 'existing' ? (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-700">Seleziona la Scuola:</label>
                      <select
                        value={regExistingSchoolId}
                        onChange={(e) => setRegExistingSchoolId(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {allSchools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (ID: {s.id})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                      <div>
                        <label className="font-bold text-slate-800 block mb-1">
                          Denominazione Ufficiale Istituto *
                        </label>
                        <input
                          type="text"
                          value={regNewSchoolName}
                          onChange={(e) => handleNewSchoolNameChange(e.target.value)}
                          placeholder="Es. I.C. Gianni Rodari"
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-bold text-slate-800 block mb-1">
                            School ID Univoco (Tenant Key) *
                          </label>
                          <input
                            type="text"
                            value={regNewSchoolId}
                            onChange={(e) => setRegNewSchoolId(e.target.value.toLowerCase())}
                            placeholder="es. ic-rodari"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                            required
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-800 block mb-1">
                            Codice Meccanografico
                          </label>
                          <input
                            type="text"
                            value={regNewSchoolCode}
                            onChange={(e) => setRegNewSchoolCode(e.target.value.toUpperCase())}
                            placeholder="Es. TOIC822005"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="font-bold text-slate-800 block mb-1">
                            Città / Comune
                          </label>
                          <input
                            type="text"
                            value={regNewCity}
                            onChange={(e) => setRegNewCity(e.target.value)}
                            placeholder="Es. Torino"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-800 block mb-1">
                            Nome Biblioteca
                          </label>
                          <input
                            type="text"
                            value={regNewLibraryName}
                            onChange={(e) => setRegNewLibraryName(e.target.value)}
                            placeholder="Es. Biblioteca Il Grillo Parlante"
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Register */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <span>Crea Account &amp; Accedi</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 space-y-1">
          <p>
            BiblioScuola • Architettura Multi-Scuola con persistenza isolata per istituto.
          </p>
          <p className="text-[11px] text-slate-500">
            Supporto scanner barcode USB • Prestiti Scan &amp; Go • Catalogazione SBN / BNI / ISBN
          </p>
        </div>
      </div>
    </div>
  );
};
