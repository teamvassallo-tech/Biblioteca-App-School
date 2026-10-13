import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import {
  VISUAL_LAYOUT_PRESETS,
  COLOR_THEME_OPTIONS,
  NAV_POSITION_OPTIONS,
  DENSITY_OPTIONS,
  CONTENT_WIDTH_OPTIONS,
  FONT_SIZE_OPTIONS,
  getPresetById,
  getActiveMatchingPreset,
  getThemeClasses,
  ColorThemeOption,
} from '../../utils/layoutPresets';
import {
  Palette,
  Layout,
  Check,
  Building,
  Monitor,
  Zap,
  LayoutGrid,
  Eye,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Maximize2,
  Smartphone,
  Layers,
} from 'lucide-react';
import {
  VisualLayoutPreset,
  NavPosition,
  ContentDensity,
  ContentWidth,
  ColorTheme,
  FontSize,
} from '../../types';

export const VisualLayoutSettings: React.FC = () => {
  const { settings, updateSettings, triggerScanFeedback } = useLibrary();
  const [showAdvancedCustomization, setShowAdvancedCustomization] = useState(false);

  const activePreset = getPresetById(settings.visualLayoutPreset);
  const exactMatchingPreset = getActiveMatchingPreset(settings);
  const theme = getThemeClasses(settings.colorTheme);

  // Apply a full preset in one click
  const handleApplyPreset = (preset: VisualLayoutPreset) => {
    updateSettings({
      visualLayoutPreset: preset.id,
      navPosition: preset.settings.navPosition,
      contentDensity: preset.settings.contentDensity,
      contentWidth: preset.settings.contentWidth,
      colorTheme: preset.settings.colorTheme,
      fontSize: preset.settings.fontSize,
    });
    triggerScanFeedback('success', `Layout applicato: "${preset.name}"!`);
  };

  // Reset to default standard preset
  const handleResetToStandard = () => {
    const standard = VISUAL_LAYOUT_PRESETS[0];
    handleApplyPreset(standard);
  };

  // Preset Wireframe Graphic Helper
  const renderPresetWireframe = (preset: VisualLayoutPreset, isSelected: boolean) => {
    const isSidebar = preset.settings.navPosition === 'sidebar';
    const isFull = preset.settings.contentWidth === 'full';
    const isWide = preset.settings.contentWidth === 'wide';
    const isLarge = preset.settings.fontSize === 'large';
    const presetTheme = getThemeClasses(preset.settings.colorTheme);

    return (
      <div
        className={`w-full h-24 rounded-lg border overflow-hidden p-1.5 transition flex flex-col justify-between ${
          isSelected
            ? 'bg-slate-100/90 border-slate-300 ring-2 ring-indigo-500/30'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        {isSidebar ? (
          // Sidebar layout wireframe
          <div className="flex h-full gap-1.5">
            {/* Sidebar column */}
            <div
              className={`w-1/4 h-full rounded bg-gradient-to-b ${presetTheme.brandGradient} flex flex-col justify-between p-1 shrink-0`}
            >
              <div className="space-y-0.5">
                <div className="w-3 h-1.5 rounded-xs bg-white/80" />
                <div className="w-full h-1 rounded-xs bg-white/40" />
                <div className="w-full h-1 rounded-xs bg-white/40" />
                <div className="w-3/4 h-1 rounded-xs bg-white/40" />
              </div>
              <div className="w-full h-1 rounded-xs bg-white/30" />
            </div>
            {/* Main content area */}
            <div className="flex-1 flex flex-col justify-between p-0.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                <div className="w-12 h-1.5 rounded-xs bg-slate-300" />
                <div className="w-5 h-1.5 rounded-xs bg-slate-300" />
              </div>
              <div className="grid grid-cols-3 gap-1 my-auto">
                <div className="h-6 rounded-xs bg-white border border-slate-200 shadow-2xs" />
                <div className="h-6 rounded-xs bg-white border border-slate-200 shadow-2xs" />
                <div className="h-6 rounded-xs bg-white border border-slate-200 shadow-2xs" />
              </div>
              <div className="w-full h-1 rounded-xs bg-slate-200" />
            </div>
          </div>
        ) : (
          // Top navigation layout wireframe
          <div className="flex flex-col h-full justify-between">
            {/* Top header */}
            <div
              className={`w-full h-3.5 rounded bg-gradient-to-r ${presetTheme.brandGradient} px-1.5 flex items-center justify-between shrink-0`}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-xs bg-white/90" />
                <div className="w-8 h-1 rounded-xs bg-white/70" />
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-1 rounded-xs bg-white/50" />
                <div className="w-3 h-1 rounded-xs bg-white/50" />
                <div className="w-3 h-1 rounded-xs bg-white/50" />
              </div>
            </div>

            {/* Sub-bar / content wrapper */}
            <div
              className={`flex-1 flex flex-col justify-between py-1 px-0.5 mx-auto ${
                isFull ? 'w-full' : isWide ? 'w-[90%]' : 'w-[80%]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`rounded-xs bg-slate-400 ${isLarge ? 'w-14 h-2' : 'w-10 h-1.5'}`} />
                <div className="flex gap-1">
                  <div className="w-4 h-1.5 rounded-xs bg-slate-200" />
                  <div className="w-4 h-1.5 rounded-xs bg-slate-200" />
                </div>
              </div>

              {/* Cards / dense grid */}
              <div className="grid grid-cols-4 gap-1 my-auto">
                <div
                  className={`rounded-xs bg-white border border-slate-200 shadow-2xs ${
                    isLarge ? 'h-6' : 'h-5'
                  }`}
                />
                <div
                  className={`rounded-xs bg-white border border-slate-200 shadow-2xs ${
                    isLarge ? 'h-6' : 'h-5'
                  }`}
                />
                <div
                  className={`rounded-xs bg-white border border-slate-200 shadow-2xs ${
                    isLarge ? 'h-6' : 'h-5'
                  }`}
                />
                <div
                  className={`rounded-xs bg-white border border-slate-200 shadow-2xs ${
                    isLarge ? 'h-6' : 'h-5'
                  }`}
                />
              </div>

              <div className="w-full h-1 rounded-xs bg-slate-200" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case 'Monitor':
        return <Monitor className="w-5 h-5" />;
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'LayoutGrid':
        return <LayoutGrid className="w-5 h-5" />;
      case 'Eye':
        return <Eye className="w-5 h-5" />;
      case 'Building':
      default:
        return <Building className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${theme.brandGradient} text-white shadow-sm`}>
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Layout Visivo &amp; Preimpostazioni</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                1-Click Preset
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Personalizza l&apos;interfaccia con configurazioni studiate per PC da banco, LIM touch, tablet o accessibilità
            </p>
          </div>
        </div>

        {/* Current status tag */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Layout attuale:</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.activeBadge}`}>
            {exactMatchingPreset ? exactMatchingPreset.name : 'Personalizzato'}
          </span>
        </div>
      </div>

      {/* Preset Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Seleziona una Preimpostazione Consigliata
          </span>
          <span className="text-[11px] text-slate-400">
            Clicca per applicare immediatamente all&apos;intera applicazione
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {VISUAL_LAYOUT_PRESETS.map((preset) => {
            const isSelected = exactMatchingPreset?.id === preset.id;
            const presetTheme = getThemeClasses(preset.settings.colorTheme);

            return (
              <div
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`relative rounded-2xl border-2 p-4 flex flex-col justify-between transition cursor-pointer group hover:shadow-md ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                {/* Header of card: Icon + Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-xl transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                        }`}
                      >
                        {getPresetIcon(preset.iconName)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                          {preset.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {preset.subtitle}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {preset.badge}
                    </span>
                  </div>

                  {/* Wireframe Diagram */}
                  <div className="my-2.5">
                    {renderPresetWireframe(preset, isSelected)}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 leading-relaxed min-h-[38px]">
                    {preset.description}
                  </p>
                </div>

                {/* Footer specs and activation button */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                  {/* Quick specs pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      Menu: {preset.settings.navPosition === 'sidebar' ? 'Sidebar' : 'In alto'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      Densità: {preset.settings.contentDensity}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                      Larghezza: {preset.settings.contentWidth}
                    </span>
                    {preset.settings.fontSize === 'large' && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                        Font LIM
                      </span>
                    )}
                  </div>

                  {/* Button state */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyPreset(preset);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Layout Attivo</span>
                      </>
                    ) : (
                      <>
                        <span>Attiva questo Layout</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Fine-Tuning Accordion */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowAdvancedCustomization(!showAdvancedCustomization)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/80 text-slate-800 transition text-xs font-bold cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Personalizzazione Avanzata dei Singoli Parametri (Menu, Palette, Spaziature)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="text-[11px] font-normal">
              {showAdvancedCustomization ? 'Nascondi dettagli' : 'Mostra regolazioni manuali'}
            </span>
            {showAdvancedCustomization ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showAdvancedCustomization && (
          <div className="mt-3 p-5 rounded-2xl border border-slate-200 bg-white space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Regolazione Fine dell&apos;Aspetto
                </h4>
                <p className="text-xs text-slate-500">
                  Modifica i singoli elementi grafici. Le modifiche vengono salvate istantaneamente.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetToStandard}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1.5 transition cursor-pointer"
                title="Ripristina layout predefinito"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ripristina Predefinito</span>
              </button>
            </div>

            {/* 1. Posizione Menu di Navigazione */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                1. Posizione del Menu di Navigazione
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {NAV_POSITION_OPTIONS.map((opt) => {
                  const isChecked = (settings.navPosition || 'top') === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => updateSettings({ navPosition: opt.id })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center gap-3 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Palette Colore Istituzionale */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                2. Palette Colore Istituzionale BiblioScuola
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {COLOR_THEME_OPTIONS.map((themeOpt: ColorThemeOption) => {
                  const isChecked = (settings.colorTheme || 'indigo') === themeOpt.id;
                  return (
                    <div
                      key={themeOpt.id}
                      onClick={() => updateSettings({ colorTheme: themeOpt.id })}
                      className={`p-2.5 rounded-xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-1.5 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/30 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="relative">
                        <div
                          className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center text-white"
                          style={{ backgroundColor: themeOpt.primaryHex }}
                        >
                          {isChecked && <Check className="w-4 h-4" />}
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                          {themeOpt.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Densità Spaziature */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                3. Spaziature &amp; Densità Interfaccia
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DENSITY_OPTIONS.map((opt) => {
                  const isChecked = (settings.contentDensity || 'comfortable') === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => updateSettings({ contentDensity: opt.id })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Larghezza Contenuto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                4. Larghezza Massima del Contenuto
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {CONTENT_WIDTH_OPTIONS.map((opt) => {
                  const isChecked = (settings.contentWidth || 'contained') === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => updateSettings({ contentWidth: opt.id })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Dimensione Caratteri & Target Touch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                5. Dimensione Testi &amp; Target Touch (LIM &amp; Accessibilità)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FONT_SIZE_OPTIONS.map((opt) => {
                  const isChecked = (settings.fontSize || 'normal') === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => updateSettings({ fontSize: opt.id })}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/30'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight block">
                          {opt.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
