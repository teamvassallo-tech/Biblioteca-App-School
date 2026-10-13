// Pure SVG Code-128 barcode renderer (no external dependencies needed)

// Code 128B character patterns (11 modules per character, alternating bar/space)
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

const START_B = 104;
const STOP = 106;

/**
 * Generate binary bar/space pattern string for text in Code 128B
 */
function encodeCode128B(text: string): string {
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

  // Convert pattern string of widths to 1s and 0s
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

/**
 * Renders an SVG string for a given text barcode
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    height?: number;
    barWidth?: number;
    includeText?: boolean;
    quietZone?: number;
  } = {}
): string {
  const {
    height = 50,
    barWidth = 1.6,
    includeText = true,
    quietZone = 10,
  } = options;

  const binary = encodeCode128B(text);
  const totalWidth = binary.length * barWidth + quietZone * 2;
  const svgHeight = includeText ? height + 16 : height;

  let rects = '';
  let currentBarWidth = 0;
  let startX = 0;

  for (let i = 0; i < binary.length; i++) {
    const isBar = binary[i] === '1';
    if (isBar) {
      if (currentBarWidth === 0) {
        startX = quietZone + i * barWidth;
      }
      currentBarWidth += barWidth;
    } else {
      if (currentBarWidth > 0) {
        rects += `<rect x="${startX.toFixed(2)}" y="0" width="${currentBarWidth.toFixed(2)}" height="${height}" fill="#0f172a" />`;
        currentBarWidth = 0;
      }
    }
  }
  if (currentBarWidth > 0) {
    rects += `<rect x="${startX.toFixed(2)}" y="0" width="${currentBarWidth.toFixed(2)}" height="${height}" fill="#0f172a" />`;
  }

  const textElement = includeText
    ? `<text x="${(totalWidth / 2).toFixed(2)}" y="${(height + 13).toFixed(2)}" font-family="monospace, monospace" font-size="11" font-weight="600" text-anchor="middle" fill="#334155">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${svgHeight}" class="w-full h-auto max-h-20 select-none">
    <rect width="100%" height="100%" fill="transparent" />
    ${rects}
    ${textElement}
  </svg>`;
}
