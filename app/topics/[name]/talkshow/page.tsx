'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/app/components/layout/Header';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Panelist {
  id: string;
  name: string;
  role: string;
}

interface ScriptLine {
  speaker: string;
  text: string;
}

interface TalkshowData {
  topic: string;
  duration_target: number;
  script: ScriptLine[];
  has_audio: boolean;
  audio_cache_key: string | null;
  panelists: Panelist[];
}

const PANELIST_COLORS: Record<string, { bg: string; border: string; text: string; avatar: string }> = {
  moderateur:     { bg: '#FDF2F8', border: '#EC4899', text: '#9D174D', avatar: 'VM' },
  expert:         { bg: '#EFF6FF', border: '#2563EB', text: '#1E40AF', avatar: 'PR' },
  journaliste:    { bg: '#ECFDF5', border: '#10B981', text: '#065F46', avatar: 'CD' },
  contradicteur:  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', avatar: 'ML' },
  prospectiviste: { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6', avatar: 'SB' },
};

export default function TalkshowPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>}>
      <TalkshowPage />
    </Suspense>
  );
}

function TalkshowPage() {
  const params = useParams();
  const topicName = decodeURIComponent(params.name as string);

  const [talkshow, setTalkshow] = useState<TalkshowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTalkshow = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/api/talkshow/topics/${encodeURIComponent(topicName)}/script?duration=300`
        );
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Pas assez de donnees pour generer un talkshow sur ce sujet');
          }
          throw new Error('Erreur lors de la generation du talkshow');
        }
        const data = await response.json();
        setTalkshow(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (topicName) fetchTalkshow();
  }, [topicName]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineIndex >= 0 && scriptContainerRef.current) {
      const el = scriptContainerRef.current.querySelector(`[data-line="${activeLineIndex}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  // Auto-play script (text mode — advance every ~4s per line)
  const handlePlayScript = useCallback(() => {
    if (!talkshow?.script) return;

    if (isPlaying) {
      setIsPlaying(false);
      setActiveLineIndex(-1);
      return;
    }

    setIsPlaying(true);
    setActiveLineIndex(0);

    let idx = 0;
    const advance = () => {
      idx++;
      if (idx < (talkshow?.script.length || 0)) {
        setActiveLineIndex(idx);
        // Estimate reading time: ~15 chars/sec
        const chars = talkshow?.script[idx]?.text.length || 60;
        const delay = Math.max(2000, Math.min(8000, chars * 65));
        setTimeout(advance, delay);
      } else {
        setIsPlaying(false);
        setActiveLineIndex(-1);
      }
    };

    const firstChars = talkshow.script[0]?.text.length || 60;
    setTimeout(advance, Math.max(2000, firstChars * 65));
  }, [isPlaying, talkshow]);

  // Request full audio version
  const handleRequestAudio = useCallback(async () => {
    if (!talkshow) return;
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/talkshow/topics/${encodeURIComponent(topicName)}/full?duration=300`
      );
      if (response.ok) {
        const data = await response.json();
        setTalkshow(data);
      }
    } catch (err) {
      // Ignore - audio is optional
    } finally {
      setLoading(false);
    }
  }, [talkshow, topicName]);

  if (loading) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#6B7280' }}>
            Generation du debat en cours...
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
            Nos 5 panelistes preparent leurs arguments
          </p>
        </div>
      </div>
    );
  }

  if (error || !talkshow) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.loadingContainer}>
          <h1 style={{ fontSize: '24px', fontFamily: 'Georgia, serif', marginBottom: '16px', color: '#000' }}>
            Talkshow non disponible
          </h1>
          <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '14px' }}>{error}</p>
          <Link href={`/topics/${encodeURIComponent(topicName)}`} style={{ color: '#2563EB', textDecoration: 'none', fontSize: '14px' }}>
            &larr; Retour au dossier
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Header />

      {/* Hero */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 24px 0',
      }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link
            href={`/topics/${encodeURIComponent(topicName)}`}
            style={{ color: '#2563EB', textDecoration: 'none', fontSize: '13px' }}
          >
            &larr; Dossier {talkshow.topic}
          </Link>
        </div>

        {/* Title */}
        <div style={{
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '2px',
          color: '#DC2626',
          textTransform: 'uppercase' as const,
          marginBottom: '8px',
        }}>
          TALKSHOW IA
        </div>
        <h1 style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '32px',
          fontWeight: 700,
          color: '#000',
          margin: '0 0 16px 0',
          lineHeight: 1.2,
        }}>
          {talkshow.topic}
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          margin: '0 0 24px 0',
          fontFamily: 'Georgia, serif',
          lineHeight: 1.5,
        }}>
          5 experts debattent et analysent les enjeux de ce dossier.
          Chaque point de vue est argumente a partir des syntheses et donnees collectees.
        </p>

        {/* Panelists bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #E5E5E5',
        }}>
          {talkshow.panelists.map((p) => {
            const colors = PANELIST_COLORS[p.id] || PANELIST_COLORS.moderateur;
            return (
              <div key={p.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}30`,
                fontSize: '12px',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: colors.border,
                  color: '#FFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                }}>
                  {colors.avatar}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: colors.text }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: '#6B7280' }}>{p.role}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '32px',
          alignItems: 'center',
        }}>
          <button
            onClick={handlePlayScript}
            style={{
              padding: '10px 24px',
              backgroundColor: isPlaying ? '#DC2626' : '#000',
              color: '#FFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isPlaying ? '\u23F8 Arreter' : '\u25B6 Lire le debat'}
          </button>

          {!talkshow.has_audio && (
            <button
              onClick={handleRequestAudio}
              style={{
                padding: '10px 24px',
                backgroundColor: '#FFF',
                color: '#000',
                border: '1px solid #E5E5E5',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Generer l&apos;audio
            </button>
          )}

          {talkshow.has_audio && talkshow.audio_cache_key && (
            <audio
              ref={audioRef}
              controls
              src={`${API_URL}/api/talkshow/audio/${talkshow.audio_cache_key}`}
              style={{ flex: 1, height: '36px' }}
            />
          )}

          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {talkshow.script.length} repliques
          </span>
        </div>

        {/* Script / Transcript */}
        <div ref={scriptContainerRef} style={{ paddingBottom: '80px' }}>
          {talkshow.script.map((line, idx) => {
            const colors = PANELIST_COLORS[line.speaker] || PANELIST_COLORS.moderateur;
            const panelist = talkshow.panelists.find(p => p.id === line.speaker);
            const isActive = idx === activeLineIndex;
            const isPast = activeLineIndex >= 0 && idx < activeLineIndex;

            return (
              <div
                key={idx}
                data-line={idx}
                onClick={() => setActiveLineIndex(idx)}
                style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '16px 0',
                  borderBottom: '1px solid #F3F4F6',
                  opacity: isPast ? 0.4 : 1,
                  transition: 'opacity 0.3s, background-color 0.3s',
                  backgroundColor: isActive ? `${colors.border}08` : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? colors.border : `${colors.border}20`,
                  color: isActive ? '#FFF' : colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: 'all 0.3s',
                }}>
                  {colors.avatar}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: colors.text,
                    }}>
                      {panelist?.name || line.speaker}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      color: '#9CA3AF',
                      fontWeight: 500,
                    }}>
                      {panelist?.role}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: 'Georgia, "Times New Roman", serif',
                    fontSize: '15px',
                    color: '#1F2937',
                    lineHeight: 1.7,
                    margin: 0,
                  }}>
                    {line.text}
                  </p>
                </div>

                {/* Border accent */}
                <div style={{
                  width: '3px',
                  backgroundColor: isActive ? colors.border : 'transparent',
                  borderRadius: '2px',
                  alignSelf: 'stretch',
                  transition: 'background-color 0.3s',
                }} />
              </div>
            );
          })}
        </div>

        {/* Back link */}
        <div style={{ paddingTop: '24px', borderTop: '1px solid #E5E5E5', marginBottom: '40px' }}>
          <Link
            href={`/topics/${encodeURIComponent(topicName)}`}
            style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}
          >
            {'\u2190 Retour au dossier'}
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#DC2626',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
