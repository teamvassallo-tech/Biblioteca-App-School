// High-resolution SVG Book Cover Generator
// Guarantees that every book in the school catalog has an elegant, beautifully styled cover,
// even when public databases do not have a scanned jacket photograph.

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function wrapText(text: string, maxCharsPerLine = 22, maxLines = 4): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  if (lines.length === 0) lines.push(text.slice(0, maxCharsPerLine));
  return lines;
}

export interface CoverTheme {
  primary: string;
  secondary: string;
  accent: string;
  textLight: string;
  badgeBg: string;
}

const GENRE_THEMES: Record<string, CoverTheme> = {
  'Narrativa': {
    primary: '#1e1b4b',
    secondary: '#4338ca',
    accent: '#a5b4fc',
    textLight: '#e0e7ff',
    badgeBg: 'rgba(99, 102, 241, 0.35)',
  },
  'Avventura': {
    primary: '#064e3b',
    secondary: '#047857',
    accent: '#6ee7b7',
    textLight: '#d1fae5',
    badgeBg: 'rgba(16, 185, 129, 0.35)',
  },
  'Fumetti & Manga': {
    primary: '#4c0519',
    secondary: '#be123c',
    accent: '#fda4af',
    textLight: '#ffe4e6',
    badgeBg: 'rgba(244, 63, 94, 0.35)',
  },
  'Fiabe & Favole': {
    primary: '#581c87',
    secondary: '#9333ea',
    accent: '#f0abfc',
    textLight: '#fae8ff',
    badgeBg: 'rgba(192, 38, 211, 0.35)',
  },
  'Scienza & Natura': {
    primary: '#083344',
    secondary: '#0e7490',
    accent: '#67e8f9',
    textLight: '#cffafe',
    badgeBg: 'rgba(6, 182, 212, 0.35)',
  },
  'Storia & Biografie': {
    primary: '#451a03',
    secondary: '#b45309',
    accent: '#fcd34d',
    textLight: '#fef3c7',
    badgeBg: 'rgba(245, 158, 11, 0.35)',
  },
  'Saggistica': {
    primary: '#0f172a',
    secondary: '#334155',
    accent: '#cbd5e1',
    textLight: '#f1f5f9',
    badgeBg: 'rgba(100, 116, 139, 0.35)',
  },
};

const DEFAULT_THEME: CoverTheme = {
  primary: '#1e293b',
  secondary: '#3b82f6',
  accent: '#93c5fd',
  textLight: '#eff6ff',
  badgeBg: 'rgba(59, 130, 246, 0.35)',
};

/**
 * Generates an SVG Data URI that renders as a realistic, beautifully designed book cover.
 */
export function generateBookCoverDataUrl(
  title: string,
  author: string = '',
  genre: string = 'Narrativa',
  schoolName: string = 'Biblioteca Scolastica'
): string {
  const cleanTitle = (title || 'Titolo Libro').trim();
  const cleanAuthor = (author || 'Autore').trim();
  const cleanGenre = (genre || 'Libro').trim();
  const theme = GENRE_THEMES[cleanGenre] || DEFAULT_THEME;

  const titleLines = wrapText(cleanTitle, 19, 4);
  const authorLines = wrapText(cleanAuthor.toUpperCase(), 25, 2);

  const startY = titleLines.length === 1 ? 230 : titleLines.length === 2 ? 210 : 190;
  const lineHeight = 36;

  const titleSvgSpans = titleLines
    .map(
      (line, i) =>
        `<tspan x="200" y="${startY + i * lineHeight}" text-anchor="middle">${escapeXml(line)}</tspan>`
    )
    .join('');

  const authorY = startY + titleLines.length * lineHeight + 40;
  const authorSvgSpans = authorLines
    .map(
      (line, i) =>
        `<tspan x="200" y="${authorY + i * 20}" text-anchor="middle">${escapeXml(line)}</tspan>`
    )
    .join('');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="coverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.primary}"/>
      <stop offset="50%" stop-color="${theme.secondary}"/>
      <stop offset="100%" stop-color="${theme.primary}"/>
    </linearGradient>

    <!-- Spine Shadow -->
    <linearGradient id="spineShadow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="4%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="8%" stop-color="#000000" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>

    <!-- Metallic Gold Foil Effect -->
    <linearGradient id="goldFoil" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>

    <!-- Radial Glow -->
    <radialGradient id="centerGlow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Cover Base -->
  <rect width="400" height="600" fill="url(#coverGrad)"/>
  <rect width="400" height="600" fill="url(#centerGlow)"/>

  <!-- Ornate Decorative Borders -->
  <rect x="25" y="25" width="350" height="550" rx="10" fill="none" stroke="${theme.accent}" stroke-opacity="0.3" stroke-width="1.5"/>
  <rect x="33" y="33" width="334" height="534" rx="8" fill="none" stroke="${theme.accent}" stroke-opacity="0.15" stroke-width="1"/>

  <!-- Corner Flourishes -->
  <path d="M 45 65 L 45 45 L 65 45" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round"/>
  <path d="M 355 65 L 355 45 L 335 45" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round"/>
  <path d="M 45 535 L 45 555 L 65 555" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round"/>
  <path d="M 355 535 L 355 555 L 335 555" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round"/>

  <!-- Genre Badge -->
  <g transform="translate(200, 75)">
    <rect x="-80" y="-14" width="160" height="28" rx="14" fill="${theme.badgeBg}" stroke="${theme.accent}" stroke-width="1"/>
    <text text-anchor="middle" y="5" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="11" font-weight="700" fill="${theme.accent}" letter-spacing="1.5">
      ${escapeXml(cleanGenre.toUpperCase())}
    </text>
  </g>

  <!-- Central Emblem / Icon Graphic -->
  <g transform="translate(200, 140)">
    <circle r="26" fill="rgba(255,255,255,0.06)" stroke="${theme.accent}" stroke-opacity="0.4" stroke-width="1.5"/>
    <path d="M -12 -5 Q 0 -12 12 -5 L 12 12 Q 0 5 -12 12 Z" fill="none" stroke="${theme.accent}" stroke-width="2" stroke-linejoin="round"/>
    <line x1="0" y1="-8" x2="0" y2="9" stroke="${theme.accent}" stroke-width="1.5"/>
  </g>

  <!-- Title Text -->
  <text font-family="Outfit, Plus Jakarta Sans, system-ui, sans-serif" font-size="24" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
    ${titleSvgSpans}
  </text>

  <!-- Divider Line -->
  <line x1="140" y1="${authorY - 20}" x2="260" y2="${authorY - 20}" stroke="${theme.accent}" stroke-opacity="0.4" stroke-width="1.5" stroke-linecap="round"/>

  <!-- Author Text -->
  <text font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="13" font-weight="700" fill="${theme.accent}" letter-spacing="1.5">
    ${authorSvgSpans}
  </text>

  <!-- Bottom School Library Seal -->
  <g transform="translate(200, 520)">
    <rect x="-115" y="-12" width="230" height="24" rx="6" fill="rgba(0,0,0,0.45)" stroke="${theme.accent}" stroke-opacity="0.3" stroke-width="1"/>
    <text text-anchor="middle" y="4" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-size="10" font-weight="700" fill="${theme.textLight}" letter-spacing="1.2">
      ${escapeXml(schoolName.toUpperCase())}
    </text>
  </g>

  <!-- Book Spine 3D Shadow -->
  <rect x="0" y="0" width="28" height="600" fill="url(#spineShadow)"/>
  <line x1="26" y1="0" x2="26" y2="600" stroke="#000000" stroke-opacity="0.35" stroke-width="1"/>
</svg>
  `.trim();

  // Robust Cross-Platform Base64 Data URI
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      const base64 = window.btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {}

  try {
    if (typeof Buffer !== 'undefined') {
      const base64 = Buffer.from(svg, 'utf-8').toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {}

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a guaranteed working cover image URL for any book.
 * If book.coverUrl is present, returns it; otherwise generates a beautiful SVG cover data URL.
 */
export function getGuaranteedCover(
  book: { coverUrl?: string; title: string; authors?: string[]; genre?: string },
  schoolName?: string
): string {
  if (book.coverUrl && book.coverUrl.trim().length > 0) {
    return book.coverUrl.trim();
  }
  const authorStr = Array.isArray(book.authors) && book.authors.length > 0 ? book.authors.join(', ') : 'Autore sconosciuto';
  return generateBookCoverDataUrl(book.title, authorStr, book.genre, schoolName);
}
