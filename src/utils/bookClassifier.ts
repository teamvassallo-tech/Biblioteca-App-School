import { GENRE_OPTIONS, AGE_GROUP_OPTIONS, Book } from '../types';

export interface BookClassification {
  genre: string;
  ageGroup: string;
  confidence: 'high' | 'medium' | 'low';
  matchedRule?: string;
}

/**
 * Intelligent classifier for Italian school library books.
 * Accurately determines the specific genre and target age group by analyzing:
 * - Title and subtitle
 * - Authors and illustrators
 * - Full description / synopsis
 * - Online categories / subjects (Google Books, OpenLibrary, SBN, WorldCat)
 * - Dewey Decimal Classification (DDC)
 */
export function classifyBook(
  title = '',
  authors: string[] | string = [],
  description = '',
  categories: string[] = [],
  dewey = ''
): BookClassification {
  const authorStr = Array.isArray(authors) ? authors.join(' ') : String(authors || '');
  const authorLower = authorStr.toLowerCase();
  const catStr = categories.join(' ').toLowerCase();
  const titleLower = title.toLowerCase();
  const descLower = description.toLowerCase();
  const fullText = `${titleLower} ${authorLower} ${catStr} ${descLower}`;
  const cleanDewey = (dewey || '').trim();

  let genre = 'Narrativa';
  let ageGroup = 'Primaria (8-11 anni - 3ª/5ª)';
  let confidence: 'high' | 'medium' | 'low' = 'low';
  let matchedRule = 'default';

  // =========================================================================
  // 1. GENRE DETERMINATION (Specific categories prioritized over generic ones)
  // =========================================================================

  // A. FUMETTI & MANGA
  if (
    cleanDewey.startsWith('741.5') ||
    catStr.includes('comic') ||
    catStr.includes('manga') ||
    catStr.includes('graphic novel') ||
    catStr.includes('fumett') ||
    catStr.includes('cartoon') ||
    catStr.includes('bande dessinée') ||
    titleLower.includes('manga') ||
    titleLower.includes('fumetto') ||
    titleLower.includes('a fumetti') ||
    titleLower.includes('topolino') ||
    titleLower.includes('paperino') ||
    titleLower.includes('diabolik') ||
    titleLower.includes('tex ') ||
    titleLower.includes('tex willer') ||
    titleLower.includes('dragon ball') ||
    titleLower.includes('naruto') ||
    titleLower.includes('one piece') ||
    titleLower.includes('asterix') ||
    titleLower.includes('tintin') ||
    titleLower.includes('zerocalcare') ||
    titleLower.includes('lupo alberto') ||
    titleLower.includes('dylan dog') ||
    titleLower.includes('diario di una schiappa') ||
    titleLower.includes('capitan mutanda') ||
    authorLower.includes('zerocalcare') ||
    authorLower.includes('gipi') ||
    authorLower.includes('leo ortolani') ||
    authorLower.includes('akira toriyama') ||
    authorLower.includes('eiichiro oda') ||
    authorLower.includes('masashi kishimoto') ||
    authorLower.includes('jeff kinney') ||
    authorLower.includes('dav pilkey') ||
    fullText.includes('striscia a fumetti') ||
    fullText.includes('romanzo grafico')
  ) {
    genre = 'Fumetti & Manga';
    confidence = 'high';
    matchedRule = 'comics_manga';
  }

  // B. FANTASY & FANTASCIENZA
  else if (
    catStr.includes('fantasy') ||
    catStr.includes('fantascienza') ||
    catStr.includes('science fiction') ||
    catStr.includes('sci-fi') ||
    catStr.includes('magic') ||
    catStr.includes('wizards') ||
    catStr.includes('dragons') ||
    catStr.includes('dystop') ||
    catStr.includes('distopi') ||
    titleLower.includes('harry potter') ||
    titleLower.includes('percy jackson') ||
    titleLower.includes('signore degli anelli') ||
    titleLower.includes('cronache di narnia') ||
    titleLower.includes('hobbit') ||
    titleLower.includes('fantascienza') ||
    titleLower.includes('distopia') ||
    titleLower.includes('1984') ||
    titleLower.includes('cyberpunk') ||
    titleLower.includes('guerre stellari') ||
    titleLower.includes('star wars') ||
    titleLower.includes('hunger games') ||
    titleLower.includes('labirinto') ||
    titleLower.includes('fabbrica di cioccolato') ||
    titleLower.includes('stregoneria') ||
    titleLower.includes('regno della fantasia') ||
    authorLower.includes('j.k. rowling') ||
    authorLower.includes('j. k. rowling') ||
    authorLower.includes('tolkien') ||
    authorLower.includes('rick riordan') ||
    authorLower.includes('c.s. lewis') ||
    authorLower.includes('philip pullman') ||
    authorLower.includes('christopher paolini') ||
    authorLower.includes('licia troisi') ||
    authorLower.includes('asimov') ||
    authorLower.includes('philip k. dick') ||
    authorLower.includes('ray bradbury') ||
    authorLower.includes('h.g. wells') ||
    authorLower.includes('george orwell') ||
    authorLower.includes('aldous huxley') ||
    authorLower.includes('roald dahl') ||
    fullText.includes('magia') ||
    fullText.includes('incantesim') ||
    fullText.includes('streg') ||
    fullText.includes('mago') ||
    fullText.includes('drago') ||
    fullText.includes('elfi') ||
    fullText.includes('extraterrestre') ||
    fullText.includes('astronave') ||
    fullText.includes('viaggio nel tempo') ||
    fullText.includes('distopico') ||
    fullText.includes('distopia')
  ) {
    genre = 'Fantasy & Fantascienza';
    confidence = 'high';
    matchedRule = 'fantasy_scifi';
  }

  // C. GIALLO & MISTERO
  else if (
    catStr.includes('mystery') ||
    catStr.includes('detective') ||
    catStr.includes('giallo') ||
    catStr.includes('thriller') ||
    catStr.includes('horror') ||
    catStr.includes('suspense') ||
    catStr.includes('crime') ||
    titleLower.includes('giallo') ||
    titleLower.includes('mistero') ||
    titleLower.includes('delitto') ||
    titleLower.includes('omicidio') ||
    titleLower.includes('assassinio') ||
    titleLower.includes('sherlock holmes') ||
    titleLower.includes('agatha christie') ||
    titleLower.includes('piccoli brividi') ||
    titleLower.includes('poirot') ||
    titleLower.includes('investigator') ||
    titleLower.includes('detective') ||
    titleLower.includes('caso ') ||
    titleLower.includes('enigma') ||
    titleLower.includes('indagine') ||
    titleLower.includes('commissario') ||
    authorLower.includes('agatha christie') ||
    authorLower.includes('conan doyle') ||
    authorLower.includes('georges simenon') ||
    authorLower.includes('andrea camilleri') ||
    authorLower.includes('r.l. stine') ||
    authorLower.includes('r. l. stine') ||
    authorLower.includes('maurizio de giovanni') ||
    authorLower.includes('donato carrisi') ||
    authorLower.includes('edgar allan poe') ||
    fullText.includes('indagini') ||
    fullText.includes('colpevole') ||
    fullText.includes('ispettore') ||
    fullText.includes('assassino') ||
    fullText.includes('poliziesco') ||
    fullText.includes('luogo del delitto')
  ) {
    genre = 'Giallo & Mistero';
    confidence = 'high';
    matchedRule = 'mystery_giallo';
  }

  // D. FIABE & FAVOLE
  else if (
    cleanDewey.startsWith('398.2') ||
    catStr.includes('fairy tale') ||
    catStr.includes('fairy tales') ||
    catStr.includes('fable') ||
    catStr.includes('folklore') ||
    catStr.includes('fiab') ||
    catStr.includes('favol') ||
    catStr.includes('leggend') ||
    titleLower.includes('fiabe') ||
    titleLower.includes('favole') ||
    titleLower.includes('fiaba') ||
    titleLower.includes('favola') ||
    titleLower.includes('cenerentola') ||
    titleLower.includes('biancaneve') ||
    titleLower.includes('cappuccetto rosso') ||
    titleLower.includes('pinocchio') ||
    titleLower.includes('piccolo principe') ||
    titleLower.includes('alice nel paese') ||
    titleLower.includes('pippi calzelunghe') ||
    titleLower.includes('filastrocche') ||
    titleLower.includes('favole al telefono') ||
    titleLower.includes('fiabe italiane') ||
    authorLower.includes('andersen') ||
    authorLower.includes('grimm') ||
    authorLower.includes('perrault') ||
    authorLower.includes('collodi') ||
    authorLower.includes('saint-exupéry') ||
    authorLower.includes('saint exupery') ||
    authorLower.includes('gianni rodari') ||
    authorLower.includes('beatrix potter') ||
    authorLower.includes('esopo') ||
    authorLower.includes('fedro') ||
    fullText.includes('c\'era una volta') ||
    fullText.includes('filastrocca')
  ) {
    genre = 'Fiabe & Favole';
    confidence = 'high';
    matchedRule = 'fairy_tales';
  }

  // E. ALBI ILLUSTRATI
  else if (
    catStr.includes('picture book') ||
    catStr.includes('albo illustrato') ||
    catStr.includes('prima infanzia') ||
    catStr.includes('cartonato') ||
    catStr.includes('libri per bambini') ||
    titleLower.includes('albo illustrato') ||
    titleLower.includes('il mio primo') ||
    titleLower.includes('la mia prima') ||
    titleLower.includes('con adesivi') ||
    titleLower.includes('pop-up') ||
    titleLower.includes('prime parole') ||
    authorLower.includes('nicoletta costa') ||
    authorLower.includes('herve tullet') ||
    authorLower.includes('eric carle') ||
    authorLower.includes('julia donaldson') ||
    fullText.includes('tavole illustrate a colori') ||
    fullText.includes('prime parole per i più piccoli')
  ) {
    genre = 'Albi Illustrati';
    confidence = 'medium';
    matchedRule = 'picture_books';
  }

  // F. SCIENZA & NATURA
  else if (
    cleanDewey.startsWith('5') ||
    cleanDewey.startsWith('60') ||
    cleanDewey.startsWith('61') ||
    cleanDewey.startsWith('62') ||
    cleanDewey.startsWith('63') ||
    catStr.includes('science') ||
    catStr.includes('nature') ||
    catStr.includes('animals') ||
    catStr.includes('scienza') ||
    catStr.includes('natura') ||
    catStr.includes('biologia') ||
    catStr.includes('fisica') ||
    catStr.includes('astronomia') ||
    catStr.includes('zoologia') ||
    catStr.includes('dinosaurs') ||
    catStr.includes('dinosauri') ||
    catStr.includes('ambiente') ||
    catStr.includes('ecologia') ||
    titleLower.includes('dinosauri') ||
    titleLower.includes('corpo umano') ||
    titleLower.includes('animali') ||
    titleLower.includes('spazio') ||
    titleLower.includes('pianeti') ||
    titleLower.includes('sistema solare') ||
    titleLower.includes('stelle') ||
    titleLower.includes('scienza') ||
    titleLower.includes('ecologia') ||
    titleLower.includes('esperimenti') ||
    titleLower.includes('vulcani') ||
    titleLower.includes('oceani') ||
    authorLower.includes('piero angela') ||
    authorLower.includes('alberto angela') ||
    authorLower.includes('stephen hawking') ||
    authorLower.includes('carlo rovelli') ||
    authorLower.includes('telmo pievani') ||
    authorLower.includes('mario tozzi')
  ) {
    genre = 'Scienza & Natura';
    confidence = 'high';
    matchedRule = 'science_nature';
  }

  // G. STORIA & BIOGRAFIE
  else if (
    cleanDewey.startsWith('9') ||
    cleanDewey.startsWith('92') ||
    catStr.includes('history') ||
    catStr.includes('biography') ||
    catStr.includes('autobiography') ||
    catStr.includes('storia') ||
    catStr.includes('biografia') ||
    catStr.includes('memoir') ||
    catStr.includes('shoah') ||
    catStr.includes('olocausto') ||
    catStr.includes('diario di viaggio') ||
    titleLower.includes('storia di ') ||
    titleLower.includes('storia del') ||
    titleLower.includes('storia dell') ||
    titleLower.includes('diario di anna frank') ||
    titleLower.includes('se questo è un uomo') ||
    titleLower.includes('seconda guerra mondiale') ||
    titleLower.includes('prima guerra mondiale') ||
    titleLower.includes('antica roma') ||
    titleLower.includes('antico egitto') ||
    titleLower.includes('medioevo') ||
    titleLower.includes('risorgimento') ||
    titleLower.includes('resistenza') ||
    titleLower.includes('shoah') ||
    titleLower.includes('olocausto') ||
    titleLower.includes('diari della motocicletta') ||
    authorLower.includes('anna frank') ||
    authorLower.includes('primo levi') ||
    authorLower.includes('liliana segre') ||
    authorLower.includes('alessandro barbero') ||
    authorLower.includes('ernesto che guevara') ||
    authorLower.includes('che guevara') ||
    authorLower.includes('corrado augias')
  ) {
    genre = 'Storia & Biografie';
    confidence = 'high';
    matchedRule = 'history_biography';
  }

  // H. POESIA & TEATRO
  else if (
    cleanDewey.startsWith('811') ||
    cleanDewey.startsWith('821') ||
    cleanDewey.startsWith('851') ||
    cleanDewey.startsWith('852') ||
    catStr.includes('poetry') ||
    catStr.includes('poesia') ||
    catStr.includes('drama') ||
    catStr.includes('teatro') ||
    catStr.includes('play') ||
    catStr.includes('rime') ||
    titleLower.includes('poesie') ||
    titleLower.includes('poesia') ||
    titleLower.includes('rime') ||
    titleLower.includes('teatro') ||
    titleLower.includes('commedia') ||
    titleLower.includes('tragedia') ||
    authorLower.includes('leopardi') ||
    authorLower.includes('ungaretti') ||
    authorLower.includes('montale') ||
    authorLower.includes('pascoli') ||
    authorLower.includes('carducci') ||
    authorLower.includes('goldoni')
  ) {
    genre = 'Poesia & Teatro';
    confidence = 'high';
    matchedRule = 'poetry_theatre';
  }

  // I. CLASSICI DELLA LETTERATURA
  else if (
    catStr.includes('classic') ||
    catStr.includes('classico') ||
    catStr.includes('classici') ||
    authorLower.includes('dante alighieri') ||
    authorLower.includes('alessandro manzoni') ||
    authorLower.includes('omero') ||
    authorLower.includes('virgilio') ||
    authorLower.includes('william shakespeare') ||
    authorLower.includes('giovanni boccaccio') ||
    authorLower.includes('luigi pirandello') ||
    authorLower.includes('giacomo leopardi') ||
    authorLower.includes('charles dickens') ||
    authorLower.includes('giovanni verga') ||
    authorLower.includes('italo svevo') ||
    authorLower.includes('ugo foscolo') ||
    authorLower.includes('francesco petrarca') ||
    authorLower.includes('torquato tasso') ||
    authorLower.includes('ludovico ariosto') ||
    authorLower.includes('niccolò machiavelli') ||
    authorLower.includes('cesare pavese') ||
    authorLower.includes('beppe fenoglio') ||
    authorLower.includes('leonardo sciascia') ||
    authorLower.includes('jane austen') ||
    authorLower.includes('dostoevskij') ||
    authorLower.includes('tolstoj') ||
    authorLower.includes('franz kafka') ||
    authorLower.includes('victor hugo') ||
    authorLower.includes('gustave flaubert') ||
    titleLower.includes('divina commedia') ||
    titleLower.includes('promessi sposi') ||
    titleLower.includes('odissea') ||
    titleLower.includes('iliade') ||
    titleLower.includes('eneide') ||
    titleLower.includes('decameron') ||
    titleLower.includes('fu mattia pascal') ||
    titleLower.includes('uno, nessuno e centomila') ||
    titleLower.includes('barone rampante') ||
    titleLower.includes('visconte dimezzato') ||
    titleLower.includes('cavaliere inesistente')
  ) {
    genre = 'Classici della Letteratura';
    confidence = 'high';
    matchedRule = 'classics';
  }

  // J. SAGGISTICA & GUIDE
  else if (
    cleanDewey.startsWith('0') ||
    cleanDewey.startsWith('1') ||
    cleanDewey.startsWith('4') ||
    catStr.includes('nonfiction') ||
    catStr.includes('saggistica') ||
    catStr.includes('essay') ||
    catStr.includes('guide') ||
    catStr.includes('reference') ||
    catStr.includes('manual') ||
    catStr.includes('dizionario') ||
    catStr.includes('enciclopedia') ||
    titleLower.includes('guida ') ||
    titleLower.includes('manuale ') ||
    titleLower.includes('dizionario') ||
    titleLower.includes('enciclopedia') ||
    titleLower.includes('come fare') ||
    titleLower.includes('grammatica')
  ) {
    genre = 'Saggistica & Guide';
    confidence = 'medium';
    matchedRule = 'nonfiction_guides';
  }

  // K. AVVENTURA
  else if (
    catStr.includes('adventure') ||
    catStr.includes('avventura') ||
    catStr.includes('action') ||
    catStr.includes('sea stories') ||
    catStr.includes('pirates') ||
    titleLower.includes('avventure di') ||
    titleLower.includes('avventura') ||
    titleLower.includes('isola del tesoro') ||
    titleLower.includes('sandokan') ||
    titleLower.includes('corsaro') ||
    titleLower.includes('pirati') ||
    titleLower.includes('ventimila leghe') ||
    titleLower.includes('giro del mondo in') ||
    titleLower.includes('viaggio al centro della terra') ||
    authorLower.includes('emilio salgari') ||
    authorLower.includes('jules verne') ||
    authorLower.includes('robert louis stevenson') ||
    authorLower.includes('jack london') ||
    authorLower.includes('daniel defoe') ||
    authorLower.includes('mark twain') ||
    authorLower.includes('rudyard kipling') ||
    authorLower.includes('herman melville') ||
    authorLower.includes('alexandre dumas') ||
    authorLower.includes('geronimo stilton') ||
    fullText.includes('spedizione') ||
    fullText.includes('giungla') ||
    fullText.includes('naufragio')
  ) {
    genre = 'Avventura';
    confidence = 'high';
    matchedRule = 'adventure';
  }

  // L. Default fallback to Narrativa
  else {
    genre = 'Narrativa';
    confidence = 'medium';
    matchedRule = 'narrativa_fallback';
  }

  // =========================================================================
  // 2. AGE GROUP DETERMINATION
  // =========================================================================

  // A. DOCENTI & GUIDE DIDATTICHE
  if (
    cleanDewey.startsWith('37') ||
    catStr.includes('didattica') ||
    catStr.includes('pedagogia') ||
    catStr.includes('insegnant') ||
    catStr.includes('education / teaching') ||
    titleLower.includes('per il docente') ||
    titleLower.includes('guida per l\'insegnante') ||
    titleLower.includes('guida didattica') ||
    titleLower.includes('pedagogia') ||
    titleLower.includes('schede operative') ||
    authorLower.includes('maria montessori') ||
    authorLower.includes('bruno munari') ||
    fullText.includes('percorso per docenti') ||
    fullText.includes('schede operative per la classe') ||
    fullText.includes('sostegno scolastico')
  ) {
    ageGroup = 'Docenti & Guide Didattiche';
  }

  // B. PRIMARIA (6-8 anni - 1ª/2ª)
  else if (
    genre === 'Albi Illustrati' ||
    catStr.includes('early reader') ||
    catStr.includes('beginner reader') ||
    catStr.includes('preschool') ||
    catStr.includes('kindergarten') ||
    catStr.includes('6-8') ||
    titleLower.includes('prime letture') ||
    titleLower.includes('stampatello') ||
    titleLower.includes('serie bianca') ||
    titleLower.includes('battello a vapore - serie bianca') ||
    titleLower.includes('letture per iniziare') ||
    titleLower.includes('con adesivi') ||
    titleLower.includes('il mio primo') ||
    fullText.includes('caratteri maiuscoli') ||
    fullText.includes('prima elementare') ||
    fullText.includes('seconda elementare') ||
    fullText.includes('per i più piccoli')
  ) {
    ageGroup = 'Primaria (6-8 anni - 1ª/2ª)';
  }

  // C. GIOVANI ADULTI (14+ anni)
  else if (
    catStr.includes('young adult') ||
    catStr.includes('ya ') ||
    catStr.includes('teen & young adult') ||
    catStr.includes('14+') ||
    genre === 'Classici della Letteratura' ||
    (genre === 'Saggistica & Guide' && !titleLower.includes('ragazzi')) ||
    titleLower.includes('1984') ||
    titleLower.includes('se questo è un uomo') ||
    titleLower.includes('scuola superiore') ||
    titleLower.includes('liceo') ||
    authorLower.includes('orwell') ||
    authorLower.includes('pirandello') ||
    authorLower.includes('dante') ||
    authorLower.includes('manzoni') ||
    authorLower.includes('primo levi') ||
    fullText.includes('adolescenza') ||
    fullText.includes('maturità') ||
    fullText.includes('romanzo per giovani adulti')
  ) {
    ageGroup = 'Giovani Adulti (14+ anni)';
  }

  // D. SECONDARIA I GRADO (11-14 anni)
  else if (
    catStr.includes('middle grade') ||
    catStr.includes('11-14') ||
    catStr.includes('scuola media') ||
    titleLower.includes('scuola media') ||
    titleLower.includes('harry potter') ||
    titleLower.includes('percy jackson') ||
    titleLower.includes('signore degli anelli') ||
    titleLower.includes('cronache di narnia') ||
    titleLower.includes('il diario di anna frank') ||
    titleLower.includes('diario di anna frank') ||
    titleLower.includes('serie rossa') ||
    titleLower.includes('battello a vapore - serie rossa') ||
    authorLower.includes('anna frank') ||
    authorLower.includes('rick riordan') ||
    fullText.includes('prima media') ||
    fullText.includes('seconda media') ||
    fullText.includes('terza media') ||
    (descLower.length > 500 && genre === 'Giallo & Mistero')
  ) {
    ageGroup = 'Secondaria I grado (11-14 anni)';
  }

  // E. PRIMARIA (8-11 anni - 3ª/5ª) (Standard children books)
  else {
    ageGroup = 'Primaria (8-11 anni - 3ª/5ª)';
  }

  return {
    genre,
    ageGroup,
    confidence,
    matchedRule,
  };
}

/**
 * Convenient helper to classify a partial or full Book object.
 */
export function suggestBookClassification(book: Partial<Book> & { categories?: string[]; dewey?: string }): BookClassification {
  return classifyBook(
    book.title || '',
    book.authors || [],
    book.synopsis || '',
    book.categories || [],
    book.dewey || ''
  );
}
