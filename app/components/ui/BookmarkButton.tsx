'use client';

import { useBookmarks } from '@/app/hooks/useBookmarks';

interface BookmarkButtonProps {
  synthesisId: string;
  title: string;
  category?: string;
  transparencyScore?: number;
  size?: 'small' | 'medium';
}

export default function BookmarkButton({
  synthesisId,
  title,
  category,
  transparencyScore,
  size = 'medium',
}: BookmarkButtonProps) {
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarks();
  const saved = isBookmarked(synthesisId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) {
      removeBookmark(synthesisId);
    } else {
      addBookmark({ id: synthesisId, title, category, transparencyScore });
    }
  };

  const iconSize = size === 'small' ? '16px' : '20px';
  const padding = size === 'small' ? '4px 8px' : '8px 12px';

  return (
    <button
      onClick={handleClick}
      title={saved ? 'Retirer des sauvegardes' : 'Sauvegarder'}
      aria-label={saved ? 'Retirer des sauvegardes' : 'Sauvegarder'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding,
        border: `1px solid ${saved ? '#2563EB' : '#E5E5E5'}`,
        backgroundColor: saved ? '#EFF6FF' : '#FFFFFF',
        color: saved ? '#2563EB' : '#6B7280',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: saved ? '600' : '400',
        transition: 'all 0.2s',
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {size === 'medium' && (saved ? 'Sauvegarde' : 'Sauvegarder')}
    </button>
  );
}
