// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

// src/utils/coverGenerator.ts
function escapeXml(unsafe) {
  return (unsafe || "").replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
function wrapText(text, maxCharsPerLine = 22, maxLines = 4) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
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
var GENRE_THEMES = {
  "Narrativa": {
    primary: "#1e1b4b",
    secondary: "#4338ca",
    accent: "#a5b4fc",
    textLight: "#e0e7ff",
    badgeBg: "rgba(99, 102, 241, 0.35)"
  },
  "Avventura": {
    primary: "#064e3b",
    secondary: "#047857",
    accent: "#6ee7b7",
    textLight: "#d1fae5",
    badgeBg: "rgba(16, 185, 129, 0.35)"
  },
  "Fumetti & Manga": {
    primary: "#4c0519",
    secondary: "#be123c",
    accent: "#fda4af",
    textLight: "#ffe4e6",
    badgeBg: "rgba(244, 63, 94, 0.35)"
  },
  "Fiabe & Favole": {
    primary: "#581c87",
    secondary: "#9333ea",
    accent: "#f0abfc",
    textLight: "#fae8ff",
    badgeBg: "rgba(192, 38, 211, 0.35)"
  },
  "Scienza & Natura": {
    primary: "#083344",
    secondary: "#0e7490",
    accent: "#67e8f9",
    textLight: "#cffafe",
    badgeBg: "rgba(6, 182, 212, 0.35)"
  },
  "Storia & Biografie": {
    primary: "#451a03",
    secondary: "#b45309",
    accent: "#fcd34d",
    textLight: "#fef3c7",
    badgeBg: "rgba(245, 158, 11, 0.35)"
  },
  "Saggistica": {
    primary: "#0f172a",
    secondary: "#334155",
    accent: "#cbd5e1",
    textLight: "#f1f5f9",
    badgeBg: "rgba(100, 116, 139, 0.35)"
  }
};
var DEFAULT_THEME = {
  primary: "#1e293b",
  secondary: "#3b82f6",
  accent: "#93c5fd",
  textLight: "#eff6ff",
  badgeBg: "rgba(59, 130, 246, 0.35)"
};
function generateBookCoverDataUrl(title, author = "", genre = "Narrativa", schoolName = "Biblioteca Scolastica") {
  const cleanTitle = (title || "Titolo Libro").trim();
  const cleanAuthor = (author || "Autore").trim();
  const cleanGenre = (genre || "Libro").trim();
  const theme = GENRE_THEMES[cleanGenre] || DEFAULT_THEME;
  const titleLines = wrapText(cleanTitle, 19, 4);
  const authorLines = wrapText(cleanAuthor.toUpperCase(), 25, 2);
  const startY = titleLines.length === 1 ? 230 : titleLines.length === 2 ? 210 : 190;
  const lineHeight = 36;
  const titleSvgSpans = titleLines.map(
    (line, i) => `<tspan x="200" y="${startY + i * lineHeight}" text-anchor="middle">${escapeXml(line)}</tspan>`
  ).join("");
  const authorY = startY + titleLines.length * lineHeight + 40;
  const authorSvgSpans = authorLines.map(
    (line, i) => `<tspan x="200" y="${authorY + i * 20}" text-anchor="middle">${escapeXml(line)}</tspan>`
  ).join("");
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
  try {
    if (typeof window !== "undefined" && typeof window.btoa === "function") {
      const base64 = window.btoa(unescape(encodeURIComponent(svg)));
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {
  }
  try {
    if (typeof Buffer !== "undefined") {
      const base64 = Buffer.from(svg, "utf-8").toString("base64");
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
var activeGeminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
var ai = new GoogleGenAI({
  apiKey: activeGeminiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
async function callGemini(options) {
  const models = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
  let lastError = null;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config
      });
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini model "${model}" call failed (${err?.message || err}), trying fallback...`);
    }
  }
  throw lastError;
}
function cleanIsbnString(isbn) {
  return isbn.replace(/[^0-9X]/gi, "").trim();
}
function isbn13ToIsbn10(isbn13) {
  if (!isbn13.startsWith("978") || isbn13.length !== 13) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const rem = sum % 11;
  const check = rem === 0 ? "0" : 11 - rem === 10 ? "X" : (11 - rem).toString();
  return core + check;
}
function isbn10ToIsbn13(isbn10) {
  if (isbn10.length !== 10) return null;
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(core[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const rem = sum % 10;
  const check = rem === 0 ? "0" : (10 - rem).toString();
  return core + check;
}
var fetchWithTimeout = async (url, ms = 4500, headers = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    return response;
  } catch {
    clearTimeout(timer);
    return null;
  }
};
async function isWorkingImageUrl(url, timeoutMs = 2500) {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("data:image/")) return true;
  if (url.includes("covers.librarything.com")) return false;
  try {
    const res = await fetchWithTimeout(url, timeoutMs, {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    });
    if (!res || !res.ok) return false;
    const cType = res.headers.get("content-type") || "";
    if (!cType.startsWith("image/")) return false;
    const cLen = res.headers.get("content-length");
    if (cLen && parseInt(cLen, 10) <= 100) return false;
    return true;
  } catch {
    return false;
  }
}
async function getOriginalBookCoverCandidates(cleanIsbn) {
  const candidates = [];
  const isbn10 = cleanIsbn.length === 10 ? cleanIsbn : isbn13ToIsbn10(cleanIsbn);
  const isbn13 = cleanIsbn.length === 13 ? cleanIsbn : isbn10ToIsbn13(cleanIsbn);
  if (isbn13) {
    const amz13 = `https://images-na.ssl-images-amazon.com/images/P/${isbn13}.01.LZZZZZZZ.jpg`;
    try {
      const res = await fetchWithTimeout(amz13, 2e3);
      if (res && res.ok) {
        const type = res.headers.get("content-type") || "";
        const len = parseInt(res.headers.get("content-length") || "0", 10);
        if (type.includes("jpeg") && len > 1500) {
          candidates.push({
            source: "Copertina Originale Editore (ISBN-13)",
            url: amz13,
            isOriginalEdition: true
          });
        }
      }
    } catch {
    }
  }
  if (isbn10) {
    const amz10 = `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`;
    try {
      const res = await fetchWithTimeout(amz10, 2e3);
      if (res && res.ok) {
        const type = res.headers.get("content-type") || "";
        const len = parseInt(res.headers.get("content-length") || "0", 10);
        if (type.includes("jpeg") && len > 1500) {
          if (!candidates.some((c) => c.url === amz10)) {
            candidates.push({
              source: "Copertina Originale Editore (ISBN-10)",
              url: amz10,
              isOriginalEdition: true
            });
          }
        }
      }
    } catch {
    }
  }
  const gbCode = isbn13 || cleanIsbn;
  const gbUrl = `https://books.google.com/books/content?vid=ISBN${gbCode}&printsec=frontcover&img=1&zoom=1`;
  try {
    const res = await fetchWithTimeout(gbUrl, 2e3);
    if (res && res.ok) {
      const type = res.headers.get("content-type") || "";
      const len = parseInt(res.headers.get("content-length") || "0", 10);
      if (type.includes("jpeg") && len > 2e3) {
        candidates.push({
          source: "Google Books (Copertina Originale)",
          url: gbUrl,
          isOriginalEdition: true
        });
      }
    }
  } catch {
  }
  const olIsbnUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
  try {
    const res = await fetchWithTimeout(olIsbnUrl, 2e3);
    if (res && res.ok) {
      const type = res.headers.get("content-type") || "";
      const len = parseInt(res.headers.get("content-length") || "0", 10);
      if (type.includes("jpeg") && len > 1e3) {
        candidates.push({
          source: "Open Library (Edizione Catalogata)",
          url: olIsbnUrl,
          isOriginalEdition: false
        });
      }
    }
  } catch {
  }
  return candidates;
}
app.get("/api/isbn/:isbn", async (req, res) => {
  try {
    const rawIsbn = req.params.isbn;
    const cleanIsbn = cleanIsbnString(rawIsbn);
    if (!cleanIsbn || cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      return res.status(400).json({ error: "Codice ISBN non valido (deve contenere 10 o 13 cifre)" });
    }
    const isbn10 = cleanIsbn.length === 10 ? cleanIsbn : isbn13ToIsbn10(cleanIsbn);
    const isbn13 = cleanIsbn.length === 13 ? cleanIsbn : isbn10ToIsbn13(cleanIsbn);
    let title = "";
    let authors = [];
    let publisher = "";
    let publicationYear = "";
    let description = "";
    let coverUrl = "";
    let categories = [];
    let pageCount = void 0;
    let foundSource = "";
    let bniIdentifier = "";
    let deweyClassification = "";
    try {
      const sbnQuery = isbn13 || cleanIsbn;
      const sbnResp = await fetchWithTimeout(
        `http://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(sbnQuery)}`,
        5e3,
        { "User-Agent": "BiblioScuola/1.0 (Gestionale Biblioteca Scolastica; scuola italiana)" }
      );
      if (sbnResp && sbnResp.ok) {
        const sbnData = await sbnResp.json();
        if (sbnData.briefRecords && sbnData.briefRecords.length > 0) {
          const rec = sbnData.briefRecords[0];
          let sbnTitle = rec.titolo || "";
          if (sbnTitle.includes(" / ")) {
            sbnTitle = sbnTitle.split(" / ")[0].trim();
          }
          if (sbnTitle.includes(" : ")) {
            sbnTitle = sbnTitle.replace(/\s*:\s*/g, " - ");
          }
          title = sbnTitle;
          if (rec.autorePrincipale) {
            let auth = rec.autorePrincipale.trim();
            if (auth.includes(",")) {
              const parts = auth.split(",").map((p) => p.trim());
              auth = `${parts[1]} ${parts[0]}`.trim();
            }
            authors = [auth];
          }
          if (rec.pubblicazione) {
            const pubText = rec.pubblicazione;
            const match = pubText.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
            if (match) {
              if (match[1]) publisher = match[1].trim();
              if (match[2]) publicationYear = match[2].trim();
            } else {
              const yearMatch = pubText.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) publicationYear = yearMatch[1];
            }
          }
          if (rec.codiceIdentificativo) {
            bniIdentifier = rec.codiceIdentificativo;
          }
          if (rec.copertina && typeof rec.copertina === "string") {
            const candidate = rec.copertina.replace(/^http:\/\//i, "https://").replace("/small/", "/large/");
            if (!candidate.includes("covers.librarything.com")) {
              coverUrl = candidate;
            }
          }
          foundSource = "BNI (Bibliografia Nazionale Italiana - BNCF) / OPAC SBN";
        }
      }
    } catch (e) {
      console.warn("BNI / OPAC SBN fetch error:", e);
    }
    const isbndbKey = req.query.isbndbKey || process.env.ISBNDB_API_KEY;
    if (isbndbKey && (!title || authors.length === 0 || !coverUrl)) {
      try {
        const isbndbResp = await fetchWithTimeout(
          `https://api2.isbndb.com/book/${cleanIsbn}`,
          3500,
          { "Authorization": isbndbKey }
        );
        if (isbndbResp && isbndbResp.ok) {
          const isbndbData = await isbndbResp.json();
          const b = isbndbData.book;
          if (b) {
            if (!title && b.title) title = b.title;
            if (authors.length === 0 && Array.isArray(b.authors)) authors = b.authors;
            if (!publisher && b.publisher) publisher = b.publisher;
            if (!publicationYear && b.date_published) publicationYear = b.date_published.slice(0, 4);
            if (!description && b.synopsis) description = b.synopsis;
            if (!coverUrl && b.image) coverUrl = b.image;
            if (b.dewey_decimal && !deweyClassification) deweyClassification = b.dewey_decimal;
            if (!foundSource) foundSource = "ISBNdb Global Database";
          }
        }
      } catch (e) {
        console.warn("ISBNdb fetch error:", e);
      }
    }
    const worldcatKey = req.query.worldcatKey || process.env.WORLDCAT_API_KEY || process.env.OCLC_WSKEY;
    if (worldcatKey && (!title || authors.length === 0)) {
      try {
        const wcResp = await fetchWithTimeout(
          `https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs?q=bn:${cleanIsbn}&limit=1`,
          4e3,
          {
            "Authorization": `Bearer ${worldcatKey}`,
            "Accept": "application/json"
          }
        );
        if (wcResp && wcResp.ok) {
          const wcData = await wcResp.json();
          const record = wcData.bibRecords?.[0];
          if (record) {
            if (!title && record.title) title = record.title;
            if (authors.length === 0 && Array.isArray(record.creator)) {
              authors = record.creator.map((c) => c.name || c);
            }
            if (!publisher && record.publisher) publisher = record.publisher;
            if (!publicationYear && record.date) publicationYear = String(record.date).slice(0, 4);
            if (!foundSource) foundSource = "WorldCat / OCLC Database";
          }
        }
      } catch (e) {
        console.warn("WorldCat / OCLC fetch error:", e);
      }
    }
    try {
      const olIsbnResp = await fetchWithTimeout(
        `https://openlibrary.org/isbn/${cleanIsbn}.json`,
        3500,
        { "User-Agent": "BiblioScuola/1.0" }
      );
      if (olIsbnResp && olIsbnResp.ok) {
        const olData = await olIsbnResp.json();
        if (!title && olData.title) title = olData.title;
        if (!publicationYear && olData.publish_date) {
          const ym = olData.publish_date.match(/\b(19\d\d|20\d\d)\b/);
          if (ym) publicationYear = ym[1];
        }
        if (!publisher && Array.isArray(olData.publishers) && olData.publishers.length > 0) {
          publisher = olData.publishers[0];
        }
        if (!pageCount && olData.number_of_pages) {
          pageCount = Number(olData.number_of_pages);
        }
        if (!coverUrl && Array.isArray(olData.covers) && olData.covers.length > 0) {
          const coverId = olData.covers[0];
          if (coverId && coverId > 0) {
            coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
          }
        }
        if (!foundSource) foundSource = "Open Library Direct";
      }
      if (!title || authors.length === 0 || !coverUrl) {
        const olSearchUrl = `https://openlibrary.org/search.json?isbn=${cleanIsbn}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`;
        const olSearchResp = await fetchWithTimeout(olSearchUrl, 3500);
        if (olSearchResp && olSearchResp.ok) {
          const olSearchData = await olSearchResp.json();
          if (olSearchData.docs && olSearchData.docs.length > 0) {
            const doc = olSearchData.docs[0];
            if (!title && doc.title) title = doc.title;
            if (authors.length === 0 && Array.isArray(doc.author_name)) authors = doc.author_name;
            if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) publisher = doc.publisher[0];
            if (!publicationYear && doc.first_publish_year) publicationYear = String(doc.first_publish_year);
            if (!coverUrl && doc.cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            }
            if (categories.length === 0 && Array.isArray(doc.subject)) {
              categories = doc.subject.slice(0, 4);
            }
            if (!foundSource) foundSource = "Open Library Search";
          }
        }
      }
    } catch (e) {
      console.warn("Open Library fetch error:", e);
    }
    try {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
      const gbResp = await fetchWithTimeout(gbUrl, 3e3);
      if (gbResp && gbResp.ok) {
        const gbData = await gbResp.json();
        if (gbData.items && gbData.items.length > 0) {
          const item = gbData.items[0];
          if (item && item.volumeInfo) {
            const info = item.volumeInfo;
            if (!title) {
              title = info.title || "";
              if (info.subtitle) title += ` - ${info.subtitle}`;
            }
            if (authors.length === 0 && info.authors) {
              authors = info.authors;
            }
            if (!publisher && info.publisher) {
              publisher = info.publisher;
            }
            if (!publicationYear && info.publishedDate) {
              publicationYear = info.publishedDate.substring(0, 4);
            }
            if (!description && info.description) {
              description = info.description;
            }
            if (categories.length === 0 && info.categories) {
              categories = info.categories;
            }
            if (!pageCount && info.pageCount) {
              pageCount = info.pageCount;
            }
            if (info.imageLinks) {
              const gbImg = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail;
              if (gbImg) {
                const secureGbImg = gbImg.replace(/^http:\/\//i, "https://").replace(/&edge=curl/gi, "");
                if (!coverUrl) {
                  coverUrl = secureGbImg;
                }
              }
            }
            if (!foundSource) foundSource = "Google Books";
          }
        }
      }
    } catch (e) {
      console.warn("Google Books fetch error:", e);
    }
    if (!title || authors.length === 0) {
      try {
        const crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(cleanIsbn)}&rows=1`;
        const crResp = await fetchWithTimeout(crossrefUrl, 3e3, {
          "User-Agent": "BiblioScuola/1.0 (mailto:scuola@biblioscuola.it)"
        });
        if (crResp && crResp.ok) {
          const crData = await crResp.json();
          const item = crData.message?.items?.[0];
          if (item) {
            if (!title && item.title && item.title.length > 0) title = item.title[0];
            if (authors.length === 0 && Array.isArray(item.author)) {
              authors = item.author.map((a) => `${a.given || ""} ${a.family || ""}`.trim());
            }
            if (!publisher && item.publisher) publisher = item.publisher;
            if (!publicationYear && item.published?.["date-parts"]?.[0]?.[0]) {
              publicationYear = String(item.published["date-parts"][0][0]);
            }
            if (!foundSource) foundSource = "Crossref Academic Index";
          }
        }
      } catch (e) {
        console.warn("Crossref fetch error:", e);
      }
    }
    if ((!title || authors.length === 0 || !description) && activeGeminiKey) {
      try {
        const promptText = !title ? `Identifica con precisione il libro cartaceo con codice ISBN "${cleanIsbn}" (o ISBN-10 "${isbn10 || ""}"). Se conosci questo libro, fornisci: titolo completo, autori (nome e cognome), casa editrice, anno indicativo, descrizione/sinossi in italiano (3 frasi) e genere scolastico (es. Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Scienza & Natura, Storia & Biografie, Saggistica). Se non sei assolutamente certo, imposta found a false.` : `Arricchisci la scheda del libro scolastico "${title}" di "${authors.join(", ")}" (ISBN: ${cleanIsbn}). Fornisci una sinossi coinvolgente in italiano per studenti/docenti e il genere letterario pi\xF9 appropriato per scuola primaria/secondaria.`;
        const aiResponse = await callGemini({
          contents: promptText,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                found: { type: Type.BOOLEAN },
                title: { type: Type.STRING },
                authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                publisher: { type: Type.STRING },
                publicationYear: { type: Type.STRING },
                description: { type: Type.STRING },
                categories: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["found", "title", "authors"]
            }
          }
        });
        const aiText = aiResponse.text?.trim() || "{}";
        const aiData = JSON.parse(aiText);
        if (aiData.found && aiData.title) {
          if (!title) title = aiData.title;
          if (authors.length === 0 && aiData.authors) authors = aiData.authors;
          if (!publisher && aiData.publisher) publisher = aiData.publisher;
          if (!publicationYear && aiData.publicationYear) publicationYear = aiData.publicationYear;
          if (!description && aiData.description) description = aiData.description;
          if (categories.length === 0 && aiData.categories) categories = aiData.categories;
          if (!foundSource) foundSource = "Gemini AI Assistant";
        }
      } catch (aiErr) {
        console.warn("Gemini ISBN fallback error:", aiErr);
      }
    }
    const originalCandidates = await getOriginalBookCoverCandidates(cleanIsbn);
    let verifiedCoverUrl = "";
    if (originalCandidates.length > 0) {
      verifiedCoverUrl = originalCandidates[0].url;
    } else if (coverUrl && await isWorkingImageUrl(coverUrl, 2e3)) {
      verifiedCoverUrl = coverUrl;
    } else if (title) {
      verifiedCoverUrl = generateBookCoverDataUrl(
        title,
        authors.length > 0 ? authors.join(", ") : "Autore",
        categories[0] || "Narrativa"
      );
    }
    if (!title && authors.length === 0) {
      return res.json({
        found: false,
        isbn: cleanIsbn,
        message: "Nessun metadato reperito sulle banche dati bibliotecarie (BNI, OPAC SBN, Open Library, Google Books, Crossref). Puoi compilare manualmente i campi o usare la fotocamera con l'AI per analizzare la copertina e il frontespizio."
      });
    }
    return res.json({
      found: true,
      isbn: cleanIsbn,
      title,
      authors,
      publisher,
      publicationYear,
      description,
      coverUrl: verifiedCoverUrl,
      coverCandidates: originalCandidates,
      categories,
      pageCount,
      bniIdentifier,
      deweyClassification,
      source: foundSource || "Banche dati bibliotecarie collegate (BNI/SBN/OpenLibrary/GoogleBooks)"
    });
  } catch (error) {
    console.error("ISBN lookup failed:", error);
    return res.status(500).json({ error: error?.message || "Errore durante la ricerca ISBN" });
  }
});
app.get("/api/cover-lookup/:isbn", async (req, res) => {
  try {
    const rawIsbn = req.params.isbn;
    const cleanIsbn = cleanIsbnString(rawIsbn);
    if (!cleanIsbn) {
      return res.status(400).json({ error: "ISBN non valido" });
    }
    const originalCandidates = await getOriginalBookCoverCandidates(cleanIsbn);
    if (originalCandidates.length > 0) {
      return res.json({
        found: true,
        coverUrl: originalCandidates[0].url,
        coverCandidates: originalCandidates,
        source: originalCandidates[0].source
      });
    }
    try {
      const olResp = await fetchWithTimeout(`https://openlibrary.org/isbn/${cleanIsbn}.json`, 3e3);
      if (olResp && olResp.ok) {
        const olData = await olResp.json();
        if (Array.isArray(olData.covers) && olData.covers.length > 0 && olData.covers[0] > 0) {
          const directIdUrl = `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg`;
          if (await isWorkingImageUrl(directIdUrl)) {
            return res.json({
              found: true,
              coverUrl: directIdUrl,
              coverCandidates: [{ source: "Open Library Archivio", url: directIdUrl, isOriginalEdition: false }],
              source: "Open Library High-Res Covers"
            });
          }
        }
      }
    } catch {
    }
    const olDirectIsbn = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
    if (await isWorkingImageUrl(olDirectIsbn)) {
      return res.json({
        found: true,
        coverUrl: olDirectIsbn,
        coverCandidates: [{ source: "Open Library ISBN Index", url: olDirectIsbn, isOriginalEdition: false }],
        source: "Open Library ISBN Index"
      });
    }
    return res.json({
      found: false,
      message: "Nessuna copertina fotografica reperita online"
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Errore ricerca copertina" });
  }
});
app.post("/api/gemini/generate-cover", async (req, res) => {
  try {
    const { title, authors, genre, synopsis, isbn, schoolName } = req.body;
    const bookTitle = (title || "Nuovo Libro").trim();
    const bookAuthors = (Array.isArray(authors) ? authors.join(", ") : authors || "Autore").trim();
    const bookGenre = (genre || "Narrativa").trim();
    const school = (schoolName || "Biblioteca Scolastica").trim();
    if (activeGeminiKey) {
      try {
        const prompt = `Sei un maestro illustratore e book cover designer professionista specializzato in grafica editoriale per biblioteche scolastiche.
Genera il codice SVG COMPLETO, moderno e artisticamente impeccabile per la copertina del seguente libro:
- Titolo del libro: "${bookTitle}"
- Autore: "${bookAuthors}"
- Genere letterario: "${bookGenre}"
- Trama/Sinossi: "${synopsis || ""}"
- Scuola: "${school}"

Requisiti tecnici e visivi dell'SVG:
1. Root tag: <svg viewBox="0 0 400 600" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
2. Palette cromatica ricca e coerente con il genere letterario.
3. Elementi vettoriali o illustrazioni simboliche centrali fortemente evocative della trama (es. elementi geometrici distopici per 1984, rosa/stelle/pianeta per Piccolo Principe, magia per fantasy, natura/animali per avventura, formule/galassia per scienza).
4. Tipografia centrata e leggibile con <text> e <tspan> (titolo evidente, nome autore, badge del genere e menzione scolastica).
5. Ombra 3D del dorso libro sul bordo sinistro (<rect width="24" height="600" fill="url(#spineShadow)"/>).
6. Cornice o bordi rifiniti ed eleganti.

Restituisci ESCLUSIVAMENTE il codice SVG valido racchiuso all'interno di un blocco: \`\`\`xml ... \`\`\` senza alcun testo prima o dopo.`;
        const aiResponse = await callGemini({
          contents: prompt
        });
        const text = aiResponse.text || "";
        const match = text.match(/<svg[\s\S]*?<\/svg>/i);
        if (match) {
          const svgCode = match[0];
          const base64 = Buffer.from(svgCode, "utf-8").toString("base64");
          return res.json({
            success: true,
            coverUrl: `data:image/svg+xml;base64,${base64}`,
            source: "Gemini AI Cover Studio"
          });
        }
      } catch (aiErr) {
        console.warn("Gemini cover generation error, falling back to Graphic SVG:", aiErr);
      }
    }
    const guaranteed = generateBookCoverDataUrl(bookTitle, bookAuthors, bookGenre, school);
    return res.json({
      success: true,
      coverUrl: guaranteed,
      source: "Graphic Cover Studio (Garantita)"
    });
  } catch (err) {
    console.error("Generate cover endpoint error:", err);
    return res.status(500).json({ error: err?.message || "Errore generazione copertina" });
  }
});
app.post("/api/gemini/book-lookup", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query mancante" });
    }
    const response = await callGemini({
      contents: `Sei un bibliotecario scolastico italiano. Analizza il seguente titolo, autore o frammento di informazioni su un libro per ragazzi/scolastico ed estrai con precisione i metadati: "${query}".`,
      config: {
        systemInstruction: "Rispondi sempre in formato JSON valido. Usa solo le categorie previste per scuole primarie e secondarie.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Titolo completo del libro" },
            authors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Elenco degli autori (Nome e Cognome)"
            },
            publisher: { type: Type.STRING, description: "Casa editrice principale" },
            publicationYear: { type: Type.STRING, description: "Anno di pubblicazione (4 cifre)" },
            description: { type: Type.STRING, description: "Breve e accattivante sinossi del libro adatta per studenti e docenti (max 3-4 frasi)" },
            genre: {
              type: Type.STRING,
              description: "Genere tra: Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Poesia & Teatro, Giallo & Mistero, Fantasy & Fantascienza, Albi Illustrati, Classici, Altro"
            },
            ageGroup: {
              type: Type.STRING,
              description: "Fascia d'et\xE0 consigliata tra: Primaria (6-8 anni), Primaria (8-11 anni), Secondaria I grado (11-14 anni), Giovani Adulti (14+), Docenti & Genitori"
            },
            isbn: { type: Type.STRING, description: "ISBN noto se disponibile, altrimenti stringa vuota" }
          },
          required: ["title", "authors", "publisher", "description", "genre", "ageGroup"]
        }
      }
    });
    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Gemini book-lookup failed:", error);
    return res.status(500).json({ error: error?.message || "Errore elaborazione AI" });
  }
});
app.post("/api/gemini/ocr-book", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Immagine base64 mancante" });
    }
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, "");
    const response = await callGemini({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          },
          {
            text: `Analizza questa immagine del frontespizio, copertina o retro di un libro per biblioteca scolastica.
Estrai con la massima accuratezza OCR:
- Titolo del libro
- Autore / Autori
- Casa editrice (Editore)
- Anno di edizione o ristampa (se leggibile)
- Codice ISBN (se visibile il codice a barre o le 10/13 cifre)
- Genere letterario scolastico
- Fascia d'et\xE0 scolastica consigliata
- Breve descrizione/sinossi del libro basata sui testi visibili o sulla conoscenza del testo.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            authors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            publisher: { type: Type.STRING },
            publicationYear: { type: Type.STRING },
            isbn: { type: Type.STRING },
            description: { type: Type.STRING },
            genre: {
              type: Type.STRING,
              description: "Es: Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Fantasy & Fantascienza, Albi Illustrati, Classici"
            },
            ageGroup: {
              type: Type.STRING,
              description: "Es: Primaria (6-8 anni), Primaria (8-11 anni), Secondaria I grado (11-14 anni), Giovani Adulti (14+)"
            }
          },
          required: ["title", "authors", "genre", "ageGroup"]
        }
      }
    });
    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Gemini OCR failed:", error);
    return res.status(500).json({ error: error?.message || "Errore analisi immagine" });
  }
});
app.post("/api/gemini/semantic-search", async (req, res) => {
  try {
    const { userQuery, catalog } = req.body;
    if (!userQuery || typeof userQuery !== "string") {
      return res.status(400).json({ error: "Query utente mancante" });
    }
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return res.json({
        recommendations: [],
        aiAdvice: "Attualmente il catalogo della biblioteca \xE8 vuoto. Catalogate i primi libri con il lettore barcode o inserimento rapido per abilitare la ricerca intelligente!"
      });
    }
    const catalogSummary = catalog.map((b) => ({
      id: b.id,
      title: b.title,
      authors: b.authors || [b.author],
      genre: b.genre,
      ageGroup: b.ageGroup,
      collocazione: b.collocazione,
      isAvailable: b.status === "Disponibile",
      synopsis: (b.synopsis || b.description || "").substring(0, 200)
    }));
    const response = await callGemini({
      contents: `Richiesta dell'utente (studente o docente): "${userQuery}".

Ecco il catalogo completo dei libri FISICAMENTE PRESENTI nella biblioteca scolastica:
${JSON.stringify(catalogSummary, null, 2)}

Istruzioni:
1. Trova tra i libri presenti nel catalogo quelli pi\xF9 attinenti e stimolanti per rispondere alla richiesta.
2. Rispondi con un elenco ordinato per pertinenza (max 5 libri).
3. Per ciascun libro raccomandato, scrivi una motivazione pedagogica chiara, calda e appassionante in italiano ("reasoning") spiegando perch\xE9 \xE8 perfetto per la richiesta.
4. Fornisci un consiglio generale di lettura o didattico ("generalAdvice") per il docente o lo studente.
5. Se nessun libro a catalogo \xE8 perfettamente a tema, indica comunque il pi\xF9 vicino e suggerisci nella nota generale quale tipologia di titolo la scuola potrebbe aggiungere in futuro.`,
      config: {
        systemInstruction: "Sei il bibliotecario intelligente e accogliente della scuola. Fai riferimento ESCLUSIVAMENTE ai libri forniti nel catalogo della biblioteca.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalAdvice: {
              type: Type.STRING,
              description: "Commento introduttivo caloroso e suggerimento didattico per l'utente"
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bookId: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER, description: "Punteggio da 0 a 100" },
                  reasoning: { type: Type.STRING, description: "Perch\xE9 questo libro \xE8 consigliato per questa richiesta specifica" }
                },
                required: ["bookId", "matchScore", "reasoning"]
              }
            }
          },
          required: ["generalAdvice", "recommendations"]
        }
      }
    });
    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    return res.json({ success: true, ...parsed });
  } catch (error) {
    console.error("Gemini semantic search failed:", error);
    return res.status(500).json({ error: error?.message || "Errore ricerca AI" });
  }
});
app.post("/api/download-card-png", (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64 || typeof base64 !== "string") {
      return res.status(400).send("Dati immagine non forniti o non validi");
    }
    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");
    if (buffer.length < 50) {
      return res.status(400).send("Immagine PNG generata corrotta o incompleta");
    }
    const safeFilename = (filename || "Tessera_80x50mm.png").replace(/[^a-zA-Z0-9_.-]/g, "_");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("Content-Length", buffer.length.toString());
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.end(buffer);
  } catch (err) {
    console.error("Error serving card PNG download:", err);
    return res.status(500).send("Errore server durante il download del PNG");
  }
});
app.post("/print-card", (req, res) => {
  try {
    const { html } = req.body;
    if (!html || typeof html !== "string") {
      return res.status(400).send("Contenuto HTML di stampa non valido");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    return res.send(html);
  } catch (err) {
    console.error("Error serving print page:", err);
    return res.status(500).send("Errore server durante la generazione della pagina di stampa");
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BiblioScuola server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
