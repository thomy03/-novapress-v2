"use client";

/**
 * AudioPlayer - Audio synthesis player for NovaPress
 * Plays TTS-generated audio summaries of syntheses
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AudioPlayerProps {
  synthesisId: string;
  title?: string;
  compact?: boolean;
}

export function AudioPlayer({ synthesisId, title, compact = false }: AudioPlayerProps) {
  const { theme, darkMode } = useTheme();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioAvailable, setAudioAvailable] = useState<boolean | null>(null);
  const [voice, setVoice] = useState<'male' | 'female'>('female');

  // Check audio availability
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const response = await fetch(`${API_URL}/api/syntheses/by-id/${synthesisId}/audio/status`);
        if (response.ok) {
          const data = await response.json();
          setAudioAvailable(data.available);
        } else {
          setAudioAvailable(false);
        }
      } catch {
        setAudioAvailable(false);
      }
    };

    checkAvailability();
  }, [synthesisId]);

  const audioUrl = `${API_URL}/api/syntheses/by-id/${synthesisId}/audio?voice=${voice}`;

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      setError(null);
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio playback failed:', err);
        setError('Lecture audio impossible');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleError = () => {
    setIsPlaying(false);
    setIsLoading(false);
    setError('Audio non disponible');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Don't render if audio not available
  if (audioAvailable === false) {
    return null;
  }

  // Loading state
  if (audioAvailable === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: compact ? '8px' : '12px',
        backgroundColor: darkMode ? '#1F2937' : '#F3F4F6',
        borderRadius: '8px',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: `2px solid ${theme.border}`,
          borderTopColor: '#3B82F6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Chargement audio...
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <button
          onClick={togglePlay}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '14px',
          }}
          title={isPlaying ? 'Pause' : 'Écouter'}
        >
          {isLoading ? '⏳' : isPlaying ? '⏸' : '▶'}
        </button>
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          preload="none"
        />
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#EFF6FF',
      border: `1px solid ${darkMode ? '#374151' : '#BFDBFE'}`,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🎧</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
          }}>
            Version audio
          </span>
        </div>
        {/* Voice selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: theme.textSecondary }}>Voix:</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value as 'male' | 'female')}
            disabled={isPlaying}
            style={{
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              border: `1px solid ${theme.border}`,
              backgroundColor: darkMode ? '#374151' : '#FFFFFF',
              color: theme.text,
              cursor: 'pointer',
            }}
          >
            <option value="female">Féminine</option>
            <option value="male">Masculine</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#FEE2E2',
          borderRadius: '6px',
          marginBottom: '12px',
          fontSize: '12px',
          color: '#991B1B',
        }}>
          {error}
        </div>
      )}

      {/* Player controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '20px',
            transition: 'transform 0.1s, background-color 0.2s',
          }}
          onMouseDown={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          {isLoading ? (
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#FFFFFF',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          ) : isPlaying ? '⏸' : '▶'}
        </button>

        {/* Progress bar and time */}
        <div style={{ flex: 1 }}>
          {/* Progress slider */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              cursor: 'pointer',
              appearance: 'none',
              backgroundColor: darkMode ? '#374151' : '#DBEAFE',
            }}
          />
          {/* Time display */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            fontSize: '11px',
            color: theme.textSecondary,
          }}>
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>
      </div>

      {/* Title */}
      {title && (
        <div style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: `1px solid ${theme.border}`,
          fontSize: '12px',
          color: theme.textSecondary,
          fontStyle: 'italic',
        }}>
          {title.length > 80 ? title.substring(0, 77) + '...' : title}
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        preload="none"
      />
    </div>
  );
}

export default AudioPlayer;
