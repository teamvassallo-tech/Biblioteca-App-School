// server.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
app.use(express.json({ limit: "20mb" }));
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
function cleanIsbnString(isbn) {
  return isbn.replace(/[^0-9X]/gi, "").trim();
}
app.get("/api/isbn/:isbn", async (req, res) => {
  try {
    const rawIsbn = req.params.isbn;
    const cleanIsbn = cleanIsbnString(rawIsbn);
    if (!cleanIsbn || cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
      return res.status(400).json({ error: "Codice ISBN non valido (deve contenere 10 o 13 cifre)" });
    }
    let title = "";
    let authors = [];
    let publisher = "";
    let publicationYear = "";
    let description = "";
    let coverUrl = "";
    let categories = [];
    let pageCount = void 0;
    try {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
      const gbResp = await fetch(gbUrl);
      if (gbResp.ok) {
        const gbData = await gbResp.json();
        if (gbData.items && gbData.items.length > 0) {
          const info = gbData.items[0].volumeInfo || {};
          title = info.title || "";
          if (info.subtitle) title += ` - ${info.subtitle}`;
          authors = info.authors || [];
          publisher = info.publisher || "";
          publicationYear = info.publishedDate ? info.publishedDate.substring(0, 4) : "";
          description = info.description || "";
          categories = info.categories || [];
          pageCount = info.pageCount;
          if (info.imageLinks) {
            const rawImg = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail;
            if (rawImg) {
              coverUrl = rawImg.replace(/^http:\/\//i, "https://").replace(/&edge=curl/gi, "");
            }
          }
        }
      }
    } catch (e) {
      console.warn("Google Books fetch error:", e);
    }
    try {
      const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`;
      const olResp = await fetch(olUrl);
      if (olResp.ok) {
        const olData = await olResp.json();
        const olBookKey = `ISBN:${cleanIsbn}`;
        const olBook = olData[olBookKey];
        if (olBook) {
          if (!title && olBook.title) title = olBook.title;
          if (authors.length === 0 && Array.isArray(olBook.authors)) {
            authors = olBook.authors.map((a) => a.name);
          }
          if (!publisher && Array.isArray(olBook.publishers) && olBook.publishers.length > 0) {
            publisher = olBook.publishers[0].name;
          }
          if (!publicationYear && olBook.publish_date) {
            const yearMatch = olBook.publish_date.match(/\b(19\d\d|20\d\d)\b/);
            if (yearMatch) publicationYear = yearMatch[1];
          }
          if (!description) {
            if (typeof olBook.notes === "string") description = olBook.notes;
            else if (typeof olBook.description === "string") description = olBook.description;
            else if (olBook.description?.value) description = olBook.description.value;
          }
          if (!coverUrl && olBook.cover) {
            coverUrl = olBook.cover.large || olBook.cover.medium || olBook.cover.small || "";
          }
          if (categories.length === 0 && Array.isArray(olBook.subjects)) {
            categories = olBook.subjects.slice(0, 5).map((s) => s.name || s);
          }
          if (!pageCount && olBook.number_of_pages) {
            pageCount = Number(olBook.number_of_pages);
          }
        }
      }
    } catch (e) {
      console.warn("Open Library fetch error:", e);
    }
    if (!coverUrl) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
    }
    if (!title && authors.length === 0) {
      return res.json({
        found: false,
        isbn: cleanIsbn,
        message: "Nessun metadato reperito sulle banche dati pubbliche. Puoi usare il riconoscimento AI o inserire i dati manualmente."
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
      coverUrl,
      categories,
      pageCount
    });
  } catch (error) {
    console.error("ISBN lookup failed:", error);
    return res.status(500).json({ error: error?.message || "Errore durante la ricerca ISBN" });
  }
});
app.post("/api/gemini/book-lookup", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query mancante" });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
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
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
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
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
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
