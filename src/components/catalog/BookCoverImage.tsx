import React, { useState, useEffect } from 'react';
import { getGuaranteedCover, generateBookCoverDataUrl } from '../../utils/coverGenerator';

interface BookCoverImageProps {
  coverUrl?: string;
  title: string;
  authors?: string[];
  genre?: string;
  isbn?: string;
  className?: string;
  alt?: string;
  schoolName?: string;
  onClick?: () => void;
}

/**
 * Robust Book Cover component with an automatic 3-stage fallback cascade:
 * 1. Primary candidate URL (OPAC SBN, LibraryThing, Google Books, ISBNdb)
 * 2. Open Library high-res cover fallback (if ISBN is available)
 * 3. Stylized high-definition SVG Book Cover with gold accents & genre color theme
 *
 * Guarantees that 100% of books ALWAYS display an attractive, polished cover!
 */
export const BookCoverImage: React.FC<BookCoverImageProps> = ({
  coverUrl,
  title,
  authors = [],
  genre = 'Narrativa',
  isbn,
  className = 'w-full h-full object-cover',
  alt,
  schoolName,
  onClick,
}) => {
  const authorStr = authors.length > 0 ? authors.join(', ') : 'Autore';
  const cleanIsbn = (isbn || '').replace(/[^0-9X]/gi, '');

  // Calculate fallback sequence
  const svgCover = generateBookCoverDataUrl(title, authorStr, genre, schoolName);
  const amazonOriginalFallback = cleanIsbn.length >= 10
    ? `https://images-na.ssl-images-amazon.com/images/P/${cleanIsbn}.01.LZZZZZZZ.jpg`
    : '';
  const openLibraryFallback = cleanIsbn.length >= 10
    ? `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`
    : '';

  // Current src being attempted
  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    if (coverUrl && coverUrl.trim().length > 0) return coverUrl.trim();
    if (amazonOriginalFallback) return amazonOriginalFallback;
    if (openLibraryFallback) return openLibraryFallback;
    return svgCover;
  });

  const [hasError, setHasError] = useState(false);
  const [stage, setStage] = useState<number>(0);

  // Reset when book props change
  useEffect(() => {
    if (coverUrl && coverUrl.trim().length > 0) {
      setCurrentSrc(coverUrl.trim());
      setStage(0);
      setHasError(false);
    } else if (amazonOriginalFallback) {
      setCurrentSrc(amazonOriginalFallback);
      setStage(1);
      setHasError(false);
    } else if (openLibraryFallback) {
      setCurrentSrc(openLibraryFallback);
      setStage(2);
      setHasError(false);
    } else {
      setCurrentSrc(svgCover);
      setStage(3);
      setHasError(false);
    }
  }, [coverUrl, isbn, title, genre]);

  const handleError = () => {
    if (stage === 0 && amazonOriginalFallback && currentSrc !== amazonOriginalFallback && !currentSrc.startsWith('data:')) {
      // Step 2: Try Amazon Italy authentic publisher cover
      setStage(1);
      setCurrentSrc(amazonOriginalFallback);
    } else if (stage <= 1 && openLibraryFallback && currentSrc !== openLibraryFallback && !currentSrc.startsWith('data:')) {
      // Step 3: Try Open Library with default=false
      setStage(2);
      setCurrentSrc(openLibraryFallback);
    } else if (currentSrc !== svgCover) {
      // Step 4: Guaranteed Stylized SVG
      setStage(3);
      setCurrentSrc(svgCover);
      setHasError(true);
    }
  };

  return (
    <img
      src={currentSrc}
      alt={alt || title}
      className={className}
      loading="lazy"
      onError={handleError}
      onLoad={(e) => {
        // Detect 1x1 or 2x2 empty transparent fallback pixels from third-party APIs
        if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 2 && e.currentTarget.naturalHeight <= 2) {
          handleError();
        }
      }}
      onClick={onClick}
    />
  );
};
