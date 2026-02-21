'use client';

import React from 'react';
import Link from 'next/link';
import { useBookmarks } from '@/app/hooks/useBookmarks';

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  'MONDE': { label: 'Monde', color: '#2563EB' },
  'TECH': { label: 'Tech', color: '#7C3AED' },
  'ECONOMIE': { label: 'Economie', color: '#059669' },
  'POLITIQUE': { label: 'Politique', color: '#DC2626' },
  'CULTURE': { label: 'Culture', color: '#D97706' },
  'SPORT': { label: 'Sport', color: '#0891B2' },
  'SCIENCES': { label: 'Sciences', color: '#4F46E5' },
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SavedPage() {
  const { bookmarks, removeBookmark } = useBookmarks();

  return (
    <div style={{
      maxWidth: '780px',
      margin: '0 auto',
      padding: '40px 20px 80px',
      fontFamily: 'Georgia, "Times New Roman", serif',
    }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          color: '#6B7280',
          textDecoration: 'none',
          marginBottom: '32px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Retour a l&apos;accueil
      </Link>

      {/* Page header */}
      <header style={{
        borderBottom: '3px solid #000000',
        paddingBottom: '16px',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '700',
          color: '#000000',
          margin: '0 0 8px 0',
          letterSpacing: '-0.5px',
          lineHeight: '1.2',
        }}>
          Articles sauvegardes
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#6B7280',
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          {bookmarks.length === 0
            ? 'Aucune synthese sauvegardee pour le moment.'
            : `${bookmarks.length} synthese${bookmarks.length > 1 ? 's' : ''} sauvegardee${bookmarks.length > 1 ? 's' : ''}`
          }
        </p>
      </header>

      {/* Empty state */}
      {bookmarks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          borderTop: '1px solid #E5E5E5',
        }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="1.5"
            style={{ marginBottom: '20px' }}
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <h2 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#374151',
            margin: '0 0 8px 0',
          }}>
            Aucune sauvegarde
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#6B7280',
            margin: '0 0 24px 0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            lineHeight: '1.6',
          }}>
            Sauvegardez des syntheses pour les retrouver ici.
            <br />
            Utilisez le bouton signet sur n&apos;importe quelle synthese.
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontWeight: '500',
              letterSpacing: '0.5px',
            }}
          >
            PARCOURIR LES SYNTHESES
          </Link>
        </div>
      )}

      {/* Bookmarks list */}
      {bookmarks.length > 0 && (
        <div>
          {bookmarks.map((bookmark, index) => {
            const catConfig = bookmark.category
              ? CATEGORY_CONFIG[bookmark.category]
              : null;

            return (
              <article
                key={bookmark.id}
                style={{
                  borderBottom: index < bookmarks.length - 1 ? '1px solid #E5E5E5' : 'none',
                  paddingBottom: '24px',
                  marginBottom: '24px',
                }}
              >
                {/* Meta row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '8px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: '12px',
                  color: '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {catConfig && (
                    <span style={{
                      color: catConfig.color,
                      fontWeight: '700',
                    }}>
                      {catConfig.label}
                    </span>
                  )}
                  {catConfig && (
                    <span style={{ color: '#D1D5DB' }}>|</span>
                  )}
                  <span>
                    Sauvegarde le {formatDate(bookmark.savedAt)}
                  </span>
                  {bookmark.transparencyScore !== undefined && bookmark.transparencyScore > 0 && (
                    <>
                      <span style={{ color: '#D1D5DB' }}>|</span>
                      <span style={{
                        color: bookmark.transparencyScore >= 70 ? '#059669' : bookmark.transparencyScore >= 40 ? '#D97706' : '#DC2626',
                        fontWeight: '600',
                      }}>
                        Score: {bookmark.transparencyScore}/100
                      </span>
                    </>
                  )}
                </div>

                {/* Title */}
                <Link
                  href={`/synthesis/${bookmark.id}`}
                  style={{
                    textDecoration: 'none',
                    color: '#000000',
                  }}
                >
                  <h2 style={{
                    fontSize: '22px',
                    fontWeight: '600',
                    color: '#000000',
                    margin: '0 0 12px 0',
                    lineHeight: '1.3',
                    letterSpacing: '-0.3px',
                  }}>
                    {bookmark.title}
                  </h2>
                </Link>

                {/* Actions row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <Link
                    href={`/synthesis/${bookmark.id}`}
                    style={{
                      fontSize: '13px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      color: '#2563EB',
                      textDecoration: 'none',
                      fontWeight: '500',
                    }}
                  >
                    Lire la synthese
                  </Link>
                  <button
                    onClick={() => removeBookmark(bookmark.id)}
                    style={{
                      fontSize: '13px',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      color: '#DC2626',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: '500',
                    }}
                  >
                    Retirer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
