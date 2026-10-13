import React, { useState } from 'react';
import { BookOpen, Sparkles, Compass, Shield, Heart, Feather, Globe } from 'lucide-react';

interface BookCoverProps {
  coverUrl?: string;
  title: string;
  authors?: string[];
  genre?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'detail';
}

const GENRE_GRADIENTS: Record<string, { bg: string; text: string; accent: string }> = {
  'Narrativa': { bg: 'from-blue-700 via-indigo-800 to-slate-900', text: 'text-blue-100', accent: 'bg-blue-400' },
  'Avventura': { bg: 'from-emerald-700 via-teal-800 to-slate-900', text: 'text-emerald-100', accent: 'bg-emerald-400' },
  'Fumetti & Manga': { bg: 'from-amber-600 via-orange-700 to-slate-900', text: 'text-amber-100', accent: 'bg-amber-400' },
  'Fiabe & Favole': { bg: 'from-pink-600 via-rose-700 to-slate-900', text: 'text-pink-100', accent: 'bg-pink-400' },
  'Scienza & Natura': { bg: 'from-cyan-700 via-teal-800 to-slate-900', text: 'text-cyan-100', accent: 'bg-cyan-400' },
  'Storia & Biografie': { bg: 'from-amber-800 via-stone-800 to-slate-900', text: 'text-amber-100', accent: 'bg-amber-400' },
  'Giallo & Mistero': { bg: 'from-zinc-800 via-slate-900 to-black', text: 'text-red-200', accent: 'bg-red-500' },
  'Fantasy & Fantascienza': { bg: 'from-purple-800 via-indigo-950 to-black', text: 'text-purple-200', accent: 'bg-purple-400' },
  'Albi Illustrati': { bg: 'from-violet-600 via-fuchsia-700 to-slate-900', text: 'text-violet-100', accent: 'bg-violet-400' },
  'Poesia & Teatro': { bg: 'from-rose-800 via-purple-900 to-slate-900', text: 'text-rose-100', accent: 'bg-rose-400' },
  'Classici della Letteratura': { bg: 'from-slate-800 via-indigo-950 to-slate-950', text: 'text-amber-200', accent: 'bg-amber-400' },
};

export const BookCover: React.FC<BookCoverProps> = ({
  coverUrl,
  title,
  authors,
  genre = 'Narrativa',
  className = '',
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);

  // If coverUrl is provided and has not failed, try to render image
  const shouldRenderImage = coverUrl && !imageError;

  const gradient = GENRE_GRADIENTS[genre] || GENRE_GRADIENTS['Narrativa'];
  const authorStr = (authors || []).join(', ');

  if (shouldRenderImage) {
    return (
      <img
        src={coverUrl}
        alt={title}
        loading="lazy"
        onError={() => setImageError(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  // Scholastic stylized cover fallback when no photo exists
  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${gradient.bg} text-white p-3 flex flex-col justify-between select-none relative overflow-hidden shadow-inner ${className}`}
    >
      {/* Decorative Book Spine Texture on left */}
      <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-black/30 border-r border-white/10" />

      {/* Top Header: Library Crest & Genre */}
      <div className="pl-2 flex items-center justify-between text-[9px] uppercase tracking-wider font-extrabold opacity-80">
        <span className="truncate max-w-[85px]">{genre}</span>
        <BookOpen className="w-3.5 h-3.5 opacity-70" />
      </div>

      {/* Center: Title & Author */}
      <div className="pl-2 my-auto text-center py-2">
        <div
          className={`font-black tracking-tight leading-tight line-clamp-3 text-white drop-shadow-sm ${
            size === 'sm' ? 'text-[11px]' : size === 'lg' || size === 'detail' ? 'text-base' : 'text-xs'
          }`}
        >
          {title}
        </div>
        {authorStr && (
          <div
            className={`font-medium ${gradient.text} mt-1.5 line-clamp-1 italic opacity-90 ${
              size === 'sm' ? 'text-[9px]' : 'text-[11px]'
            }`}
          >
            {authorStr}
          </div>
        )}
      </div>

      {/* Bottom: Library Brand Stamp */}
      <div className="pl-2 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] font-bold tracking-widest uppercase opacity-75">
        <span>BiblioScuola</span>
        <div className={`w-1.5 h-1.5 rounded-full ${gradient.accent}`} />
      </div>
    </div>
  );
};
