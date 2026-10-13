import type { Student, AppSettings } from '../types/index';

export type CardThemeId = 'navy' | 'emerald' | 'indigo' | 'primaria' | 'monochrome';

export interface CardTheme {
  id: CardThemeId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  headerTextColor: string;
  badgeBg: string;
  badgeText: string;
  borderStroke: string;
  textColor: string;
  subtextColor: string;
  cardBg: string;
}

export const CARD_THEMES: Record<CardThemeId, CardTheme> = {
  navy: {
    id: 'navy',
    name: 'Blu Istituzionale & Oro',
    primaryColor: '#0f2744',
    secondaryColor: '#1e3a8a',
    accentColor: '#d97706',
    headerGradientStart: '#0f172a',
    headerGradientEnd: '#1e3a5f',
    headerTextColor: '#ffffff',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    borderStroke: '#1e3a8a',
    textColor: '#0f172a',
    subtextColor: '#475569',
    cardBg: '#ffffff',
  },
  emerald: {
    id: 'emerald',
    name: 'Verde Smeraldo Scuola',
    primaryColor: '#064e3b',
    secondaryColor: '#047857',
    accentColor: '#059669',
    headerGradientStart: '#064e3b',
    headerGradientEnd: '#065f46',
    headerTextColor: '#ffffff',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    borderStroke: '#047857',
    textColor: '#064e3b',
    subtextColor: '#334155',
    cardBg: '#ffffff',
  },
  indigo: {
    id: 'indigo',
    name: 'Smart Indigo & Viola',
    primaryColor: '#312e81',
    secondaryColor: '#4338ca',
    accentColor: '#6366f1',
    headerGradientStart: '#1e1b4b',
    headerGradientEnd: '#3730a3',
    headerTextColor: '#ffffff',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    borderStroke: '#4338ca',
    textColor: '#1e1b4b',
    subtextColor: '#4b5563',
    cardBg: '#ffffff',
  },
  primaria: {
    id: 'primaria',
    name: 'Colorata Junior Primaria',
    primaryColor: '#0369a1',
    secondaryColor: '#0284c7',
    accentColor: '#f59e0b',
    headerGradientStart: '#0284c7',
    headerGradientEnd: '#0369a1',
    headerTextColor: '#ffffff',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    borderStroke: '#0284c7',
    textColor: '#0f172a',
    subtextColor: '#475569',
    cardBg: '#ffffff',
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monocromatico B/W (Termica & Eco)',
    primaryColor: '#000000',
    secondaryColor: '#18181b',
    accentColor: '#27272a',
    headerGradientStart: '#000000',
    headerGradientEnd: '#18181b',
    headerTextColor: '#ffffff',
    badgeBg: '#f4f4f5',
    badgeText: '#09090b',
    borderStroke: '#000000',
    textColor: '#000000',
    subtextColor: '#27272a',
    cardBg: '#ffffff',
  },
};

// Code 128B character patterns
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

function encodeCode128B(text: string): string {
  const START_B = 104;
  const STOP = 106;
  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      codes.push(code);
      checksum += code * (i + 1);
    }
  }

  const checkCode = checksum % 103;
  codes.push(checkCode);
  codes.push(STOP);

  let binary = '';
  for (const c of codes) {
    const pattern = CODE128_PATTERNS[c] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      binary += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  }

  return binary;
}

export interface CardRenderOptions {
  themeId?: CardThemeId;
  academicYear?: string;
  showSchoolName?: boolean;
  showLibraryName?: boolean;
  showFooterNotes?: boolean;
}

/**
 * Escapes XML characters for safe SVG inclusion
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncates string gracefully with ellipsis if it exceeds maxLength
 */
function fitText(str: string, maxLength: number): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength - 1).trim() + '…';
}

/**
 * Helper to convert Base64 Data URL to pure binary Blob
 */
function base64ToBlob(base64Data: string, contentType = 'image/png'): Blob {
  const parts = base64Data.split(';base64,');
  const base64String = parts[1] || parts[0];
  const binaryString = window.atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType });
}

/**
 * Generates an SVG string representation of the 80x50 mm card.
 * Coordinate space is 800 x 500 (10 units = 1 mm)
 * width="80mm" height="50mm" viewBox="0 0 800 500"
 * Guaranteed ZERO text overlap through carefully partitioned vertical zones and dynamic font scaling.
 */
export function generateStudentCardSvg(
  student: Student,
  settings: Partial<AppSettings> = {},
  options: CardRenderOptions = {}
): string {
  const theme = CARD_THEMES[options.themeId || 'navy'];

  // Clean and prepare texts
  const rawSchoolName = (settings.schoolName || 'ISTITUTO COMPRENSIVO').toUpperCase().trim();
  const rawLibraryName = (settings.libraryName || 'Biblioteca Scolastica').trim();
  const rawFullName = `${student.lastName} ${student.firstName}`.toUpperCase().trim();
  const rawClass = student.classSection?.trim() || 'N/D';
  const rawLevel = student.schoolLevel?.trim() || 'Primaria';
  const studentCode = student.studentCode?.trim() || 'ALU-0001';
  const academicYear = options.academicYear?.trim() || 'A.S. 2025/2026';

  // 1. Dynamic Font Sizes to prevent any horizontal collision
  let schoolFontSize = 17;
  if (rawSchoolName.length > 36) schoolFontSize = 13.5;
  else if (rawSchoolName.length > 25) schoolFontSize = 15;
  const schoolName = fitText(rawSchoolName, 44);

  let libFontSize = 14.5;
  if (rawLibraryName.length > 36) libFontSize = 12;
  else if (rawLibraryName.length > 24) libFontSize = 13.5;
  const libraryName = fitText(rawLibraryName, 46);

  let nameFontSize = 24;
  if (rawFullName.length > 32) nameFontSize = 16.5;
  else if (rawFullName.length > 24) nameFontSize = 19;
  else if (rawFullName.length > 18) nameFontSize = 22;
  const fullName = fitText(rawFullName, 38);

  let classFontSize = 18;
  if (rawClass.length > 4) classFontSize = 14.5;

  let levelFontSize = 13.5;
  if (rawLevel.length > 20) levelFontSize = 11;
  else if (rawLevel.length > 14) levelFontSize = 12.5;

  // Barcode binary generation
  const binary = encodeCode128B(studentCode);
  const targetBarcodeWidth = 540;
  const barWidth = targetBarcodeWidth / binary.length;
  const barcodeStartX = (800 - targetBarcodeWidth) / 2; // = 130
  const barcodeY = 258;
  const barcodeHeight = 84;

  let barcodeBars = '';
  let curWidth = 0;
  let barStart = 0;

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      if (curWidth === 0) {
        barStart = barcodeStartX + i * barWidth;
      }
      curWidth += barWidth;
    } else {
      if (curWidth > 0) {
        barcodeBars += `<rect x="${barStart.toFixed(1)}" y="${barcodeY}" width="${curWidth.toFixed(1)}" height="${barcodeHeight}" fill="#0f172a" />`;
        curWidth = 0;
      }
    }
  }
  if (curWidth > 0) {
    barcodeBars += `<rect x="${barStart.toFixed(1)}" y="${barcodeY}" width="${curWidth.toFixed(1)}" height="${barcodeHeight}" fill="#0f172a" />`;
  }

  // Initials for avatar
  const firstLetter = (student.firstName && student.firstName[0]) || 'A';
  const lastLetter = (student.lastName && student.lastName[0]) || 'L';
  const initials = `${firstLetter}${lastLetter}`.toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="50mm" viewBox="0 0 800 500" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <!-- Header Gradient -->
    <linearGradient id="headerGrad-${student.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.headerGradientStart}" />
      <stop offset="100%" stop-color="${theme.headerGradientEnd}" />
    </linearGradient>

    <!-- Subtle Background Dot Pattern -->
    <pattern id="cardDots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.8" fill="#e2e8f0" />
    </pattern>
  </defs>

  <!-- Card Base (80mm x 50mm = 800 x 500) -->
  <rect x="0" y="0" width="800" height="500" rx="20" ry="20" fill="${theme.cardBg}" />
  <rect x="0" y="0" width="800" height="500" rx="20" ry="20" fill="url(#cardDots)" opacity="0.5" />

  <!-- Outer Delicate Border (1.2mm inset) -->
  <rect x="12" y="12" width="776" height="476" rx="16" ry="16" fill="none" stroke="${theme.borderStroke}" stroke-width="2.5" opacity="0.35" />

  <!-- ==================== HEADER BAR (Y: 0 to 92) ==================== -->
  <path d="M 0 20 Q 0 0 20 0 L 780 0 Q 800 0 800 20 L 800 92 L 0 92 Z" fill="url(#headerGrad-${student.id})" />
  <!-- Header Accent Line -->
  <line x1="0" y1="92" x2="800" y2="92" stroke="${theme.accentColor}" stroke-width="3" />

  <!-- School Crest / Emblem (Left: x=24, y=16) -->
  <g transform="translate(24, 16)">
    <rect x="0" y="0" width="60" height="60" rx="14" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.5" />
    <!-- Stylized Book and Mortarboard -->
    <path d="M 15 42 C 22 38 28 38 30 41 C 32 38 38 38 45 42 L 45 22 C 38 19 32 19 30 21 C 28 19 22 19 15 22 Z" fill="#ffffff" />
    <path d="M 30 21 L 30 41" stroke="${theme.headerGradientStart}" stroke-width="2" />
    <polygon points="30,13 43,18 30,23 17,18" fill="${theme.accentColor}" />
  </g>

  <!-- Left Header Text (x: 96 to 570, max width 474px) -->
  <text x="96" y="37" fill="${theme.headerTextColor}" font-size="${schoolFontSize}" font-weight="800" letter-spacing="0.5">${escapeXml(schoolName)}</text>
  <text x="96" y="60" fill="rgba(255, 255, 255, 0.92)" font-size="${libFontSize}" font-weight="600">${escapeXml(libraryName)}</text>
  <text x="96" y="78" fill="rgba(255, 255, 255, 0.72)" font-size="10.5" font-weight="600" letter-spacing="0.6">SISTEMA BIBLIOTECARIO SCOLASTICO DIGITALE</text>

  <!-- Right Header Badges (x: 584 to 776) -->
  <!-- Pill 1: "TESSERA LETTORE" -->
  <g transform="translate(584, 16)">
    <rect x="0" y="0" width="186" height="30" rx="15" fill="${theme.badgeBg}" stroke="${theme.accentColor}" stroke-width="1.2" />
    <text x="93" y="20" fill="${theme.badgeText}" font-size="11" font-weight="800" text-anchor="middle" letter-spacing="0.8">TESSERA LETTORE</text>
  </g>

  <!-- Pill 2: Academic Year -->
  <g transform="translate(606, 52)">
    <rect x="0" y="0" width="142" height="26" rx="8" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255, 255, 255, 0.25)" stroke-width="1" />
    <text x="71" y="18" fill="#ffffff" font-size="11.5" font-weight="700" text-anchor="middle" letter-spacing="0.5">${escapeXml(academicYear)}</text>
  </g>

  <!-- ==================== STUDENT IDENTITY SECTION (Y: 104 to 216) ==================== -->
  <!-- Avatar / Initials Seal (Left: x=28, y=106) -->
  <g transform="translate(28, 106)">
    <rect x="0" y="0" width="86" height="84" rx="16" fill="${theme.secondaryColor}" opacity="0.1" />
    <rect x="0" y="0" width="86" height="84" rx="16" fill="none" stroke="${theme.secondaryColor}" stroke-width="2.2" />
    <text x="43" y="54" fill="${theme.primaryColor}" font-size="34" font-weight="900" text-anchor="middle" letter-spacing="1">${escapeXml(initials)}</text>
  </g>
  <!-- Role pill under avatar -->
  <g transform="translate(28, 196)">
    <rect x="0" y="0" width="86" height="20" rx="6" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1" />
    <text x="43" y="14" fill="#475569" font-size="9.5" font-weight="800" text-anchor="middle" letter-spacing="0.5">LETTORE</text>
  </g>

  <!-- Student Full Name (x: 128, y: 136) -->
  <text x="128" y="136" fill="${theme.textColor}" font-size="${nameFontSize}" font-weight="900" letter-spacing="0.4">${escapeXml(fullName)}</text>

  <!-- Badges Row (y: 152 to 206, height 54px) -->
  <!-- Badge 1: Classe (width 118) -->
  <g transform="translate(128, 152)">
    <rect x="0" y="0" width="118" height="54" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />
    <text x="16" y="19" fill="#64748b" font-size="9" font-weight="700" letter-spacing="0.6">CLASSE</text>
    <text x="16" y="43" fill="${theme.primaryColor}" font-size="${classFontSize}" font-weight="900">${escapeXml(rawClass)}</text>
  </g>

  <!-- Badge 2: Grado Scolastico (width 234) -->
  <g transform="translate(256, 152)">
    <rect x="0" y="0" width="234" height="54" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />
    <text x="16" y="19" fill="#64748b" font-size="9" font-weight="700" letter-spacing="0.6">GRADO SCOLASTICO</text>
    <text x="16" y="42" fill="#1e293b" font-size="${levelFontSize}" font-weight="800">${escapeXml(rawLevel)}</text>
  </g>

  <!-- Badge 3: Codice Tessera (width 272) -->
  <g transform="translate(500, 152)">
    <rect x="0" y="0" width="272" height="54" rx="10" fill="${theme.badgeBg}" stroke="${theme.accentColor}" stroke-width="1.4" />
    <text x="16" y="19" fill="${theme.badgeText}" font-size="9" font-weight="700" letter-spacing="0.6">CODICE LETTORE</text>
    <text x="16" y="43" fill="${theme.badgeText}" font-size="17" font-weight="900" font-family="monospace, monospace">${escapeXml(studentCode)}</text>
  </g>

  <!-- ==================== BARCODE SECTION (Y: 220 to 424) ==================== -->
  <rect x="28" y="220" width="744" height="204" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- Barcode Header Label -->
  <text x="400" y="244" fill="#64748b" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">CODICE A BARRE PER LETTURA OTTICA SCAN &amp; GO</text>

  <!-- Barcode Bars (Y: 258 to 342, Height: 84) -->
  <g>
    ${barcodeBars}
  </g>

  <!-- Alphanumeric Code Display Box (Y: 356 to 390) -->
  <rect x="250" y="356" width="300" height="34" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.2" />
  <text x="400" y="379" fill="#0f172a" font-size="17" font-weight="900" font-family="monospace, monospace" text-anchor="middle" letter-spacing="3">* ${escapeXml(studentCode)} *</text>

  <!-- Helper Scan Instructions Under Code -->
  <text x="400" y="408" fill="#94a3b8" font-size="9.5" font-weight="500" text-anchor="middle">
    Presenta questa tessera al banco biblioteca per il prestito e la restituzione rapida
  </text>

  <!-- ==================== FOOTER SECTION (Y: 432 to 500) ==================== -->
  <line x1="28" y1="434" x2="772" y2="434" stroke="#e2e8f0" stroke-width="1.2" />

  <text x="400" y="456" fill="#475569" font-size="11.5" font-weight="600" text-anchor="middle">
    Tessera personale non cedibile • Valida per tutti i servizi della biblioteca scolastica
  </text>
  <text x="400" y="476" fill="#94a3b8" font-size="10" font-weight="500" text-anchor="middle">
    Dimensioni standard 80 x 50 mm • BiblioScuola Smart Pass
  </text>
</svg>`;

  return svg;
}

/**
 * Generates a complete, self-contained HTML document ready for pixel-perfect printing.
 * Works both in direct iframe printing, standalone browser tab, or saved file.
 */
export function generatePrintableHtmlDoc(
  cardSvg: string,
  mode: 'single' | 'a4-sheet',
  docTitle = 'Stampa_Tessera_80x50mm'
): string {
  const isSingle = mode === 'single';

  const pageCss = isSingle
    ? `@page { size: 80mm 50mm; margin: 0; }
       *, *::before, *::after { box-sizing: border-box; }
       html, body { margin: 0 !important; padding: 0 !important; width: 80mm !important; height: 50mm !important; background: #ffffff !important; overflow: hidden !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
       .badge-container { width: 80mm !important; height: 50mm !important; display: block !important; margin: 0 !important; padding: 0 !important; }
       .badge-container svg { width: 80mm !important; height: 50mm !important; display: block !important; }`
    : `@page { size: A4 portrait; margin: 8mm 6mm; }
       *, *::before, *::after { box-sizing: border-box; }
       html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
       .grid { display: grid; grid-template-columns: repeat(2, 80mm); gap: 10mm 12mm; justify-content: center; padding-top: 5mm; margin: 0 auto; }
       .card { width: 80mm; height: 50mm; position: relative; border: 1px dashed #cbd5e1; box-sizing: border-box; page-break-inside: avoid; break-inside: avoid; }
       .card svg { width: 80mm; height: 50mm; display: block; }
       .cut { position: absolute; font-size: 9px; color: #94a3b8; font-family: monospace; line-height: 1; user-select: none; }`;

  let bodyContent = '';
  if (isSingle) {
    bodyContent = `<div class="badge-container">${cardSvg}</div>`;
  } else {
    bodyContent = `<div class="grid">`;
    for (let i = 0; i < 8; i++) {
      bodyContent += `
        <div class="card">
          <span class="cut" style="top:-3.5mm;left:-3.5mm;">+</span>
          <span class="cut" style="top:-3.5mm;right:-3.5mm;">+</span>
          <span class="cut" style="bottom:-3.5mm;left:-3.5mm;">+</span>
          <span class="cut" style="bottom:-3.5mm;right:-3.5mm;">+</span>
          ${cardSvg}
        </div>
      `;
    }
    bodyContent += `</div>`;
  }

  const screenBarHtml = `
    <div id="screen-print-bar" style="
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-bottom: 2px solid #3b82f6;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 20px;">🖨️</div>
        <div>
          <div style="font-weight: 800; font-size: 15px;">
            ${isSingle ? 'Stampa Badge Singolo (Formato 80 x 50 mm)' : 'Stampa Foglio A4 (8 Tessere con crocini)'}
          </div>
          <div style="font-size: 12px; color: #94a3b8;">
            Consiglio: nella finestra di stampa seleziona <strong>Margini: Nessuno</strong> e attiva <strong>Grafica in background</strong>.
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <button onclick="window.print()" style="
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 8px 18px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          Avvia Stampa (Ctrl+P)
        </button>
        <button onclick="window.close()" style="
          background: #334155;
          color: #e2e8f0;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        ">
          Chiudi
        </button>
      </div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <style>
    ${pageCss}
    @media screen {
      body {
        margin: 0;
        background: #f1f5f9;
        min-height: 100vh;
      }
      .print-wrapper {
        padding: 30px;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .badge-container {
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        overflow: hidden;
      }
    }
    @media print {
      #screen-print-bar {
        display: none !important;
      }
      .print-wrapper {
        padding: 0 !important;
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${screenBarHtml}
  <div class="print-wrapper">
    ${bodyContent}
  </div>
  <script>
    // Automatically trigger print dialog on page load
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Auto-print error', e);
        }
      }, 250);
    });
  </script>
</body>
</html>`;
}

/**
 * Opens a dedicated standalone print tab in the browser, completely immune to iframe sandboxing.
 */
export function openPrintPageInNewTab(
  cardSvg: string,
  mode: 'single' | 'a4-sheet',
  docTitle = 'Stampa_Tessera_80x50mm'
): void {
  const htmlDoc = generatePrintableHtmlDoc(cardSvg, mode, docTitle);

  try {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/print-card';
    form.target = '_blank';
    form.style.display = 'none';

    const inputHtml = document.createElement('input');
    inputHtml.type = 'hidden';
    inputHtml.name = 'html';
    inputHtml.value = htmlDoc;
    form.appendChild(inputHtml);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      try {
        document.body.removeChild(form);
      } catch (e) {}
    }, 2000);
  } catch (err) {
    console.error('Error opening print page in new tab:', err);
    // Fallback: download HTML file
    downloadPrintableHtmlFile(cardSvg, mode, docTitle);
  }
}

/**
 * Triggers direct printing using a dedicated hidden iframe.
 * If the iframe is blocked by browser sandbox restrictions, automatically opens the standalone tab.
 */
export function executeCardPrint(
  cardSvg: string,
  mode: 'single' | 'a4-sheet',
  docTitle = 'Stampa_Tessera_80x50mm'
): boolean {
  const htmlDoc = generatePrintableHtmlDoc(cardSvg, mode, docTitle);

  let printFrame = document.getElementById('biblio-silent-print-frame') as HTMLIFrameElement;
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'biblio-silent-print-frame';
    printFrame.setAttribute(
      'style',
      'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'
    );
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow?.document;
  if (frameDoc) {
    try {
      frameDoc.open();
      frameDoc.write(htmlDoc);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (printErr) {
          console.warn('Silent iframe print blocked, opening new tab fallback:', printErr);
          openPrintPageInNewTab(cardSvg, mode, docTitle);
        }
      }, 300);
      return true;
    } catch (docErr) {
      console.warn('Silent iframe write error, opening new tab fallback:', docErr);
      openPrintPageInNewTab(cardSvg, mode, docTitle);
      return false;
    }
  } else {
    openPrintPageInNewTab(cardSvg, mode, docTitle);
    return false;
  }
}

/**
 * Triggers download of the 80x50 mm card as an SVG file
 */
export function downloadStudentCardSvg(
  student: Student,
  settings: Partial<AppSettings> = {},
  options: CardRenderOptions = {}
): void {
  const svgString = generateStudentCardSvg(student, settings, options);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = `${student.lastName}_${student.firstName}_${student.studentCode}`.replace(/\s+/g, '_');
  link.download = `Tessera_${safeName}_80x50mm.svg`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 60000);
}

/**
 * Renders the 80x50 mm card to high-resolution PNG (300 DPI = 945 x 590 px) and downloads it.
 * Uses a robust dual-strategy: server-side attachment streaming (which prevents 0-byte or corrupted downloads
 * inside sandboxed iframes) with a direct base64 client-side download fallback.
 */
export async function downloadStudentCardPng(
  student: Student,
  settings: Partial<AppSettings> = {},
  options: CardRenderOptions = {}
): Promise<void> {
  const svgString = generateStudentCardSvg(student, settings, options);

  const widthPx = 945;
  const heightPx = 590;

  // Substitute mm dimensions with exact pixel dimensions and remove any comments
  const svgForCanvas = svgString
    .replace('width="80mm" height="50mm"', `width="${widthPx}" height="${heightPx}" preserveAspectRatio="xMidYMid meet"`)
    .replace(/<!--[\s\S]*?-->/g, '');

  // Convert SVG to Base64 data URL to safely preserve all gradients, symbols and unicode characters
  let base64Svg: string;
  try {
    base64Svg = window.btoa(unescape(encodeURIComponent(svgForCanvas)));
  } catch (e) {
    base64Svg = window.btoa(svgForCanvas);
  }
  const svgDataUrl = `data:image/svg+xml;base64,${base64Svg}`;

  const img = new Image();
  // IMPORTANT: Do NOT set crossOrigin on a data: URL as it can cause CORS errors/canvas tainting in Chrome
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      if ('decode' in img) {
        img.decode().then(resolve).catch(() => resolve());
      } else {
        resolve();
      }
    };
    img.onerror = (err) => reject(new Error('Errore durante il caricamento grafico dell\'immagine SVG: ' + err));
    img.src = svgDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context non disponibile nel browser');
  }

  // Draw clean solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Draw rendered SVG image
  ctx.drawImage(img, 0, 0, widthPx, heightPx);

  // Extract base64 PNG
  const pngDataUrl = canvas.toDataURL('image/png');
  if (!pngDataUrl || pngDataUrl === 'data:,' || pngDataUrl.length < 500) {
    throw new Error('Canvas rendering ha generato un output non valido o corrotto');
  }

  const safeName = `${student.lastName}_${student.firstName}_${student.studentCode}`.replace(/\s+/g, '_');
  const filename = `Tessera_${safeName}_80x50mm.png`;

  // Strategy 1: Post to /api/download-card-png for genuine binary HTTP attachment download.
  // This bypasses browser iframe restrictions on blob: URLs which often lead to 0-byte or corrupted downloads.
  let serverDownloadSuccess = false;
  try {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download-card-png';
    form.style.display = 'none';

    const inputBase64 = document.createElement('input');
    inputBase64.type = 'hidden';
    inputBase64.name = 'base64';
    inputBase64.value = pngDataUrl;
    form.appendChild(inputBase64);

    const inputName = document.createElement('input');
    inputName.type = 'hidden';
    inputName.name = 'filename';
    inputName.value = filename;
    form.appendChild(inputName);

    document.body.appendChild(form);
    form.submit();
    serverDownloadSuccess = true;

    setTimeout(() => {
      try {
        document.body.removeChild(form);
      } catch (e) {}
    }, 3000);
  } catch (err) {
    console.warn('Server PNG download form submit failed, trying client-side fallback:', err);
  }

  // Strategy 2 (Fallback): Direct client-side download using the base64 data URL
  if (!serverDownloadSuccess) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = pngDataUrl;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch (e) {}
    }, 1000);
  }
}

/**
 * Downloads a standalone, self-contained HTML file that opens print preview automatically.
 * Works even if browser blocks iframe printing or popups.
 */
export function downloadPrintableHtmlFile(
  cardSvg: string,
  mode: 'single' | 'a4-sheet',
  docTitle = 'Stampa_Tessera_80x50mm'
): void {
  const htmlContent = generatePrintableHtmlDoc(cardSvg, mode, docTitle);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${docTitle}.html`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 60000);
}
