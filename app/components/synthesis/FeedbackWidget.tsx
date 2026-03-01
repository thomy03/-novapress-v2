'use client';

import React, { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface FeedbackWidgetProps {
  synthesisId: string;
  initialAvgRating?: number;
  initialFeedbackCount?: number;
}

export default function FeedbackWidget({
  synthesisId,
  initialAvgRating = 0,
  initialFeedbackCount = 0,
}: FeedbackWidgetProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [avgRating, setAvgRating] = useState(initialAvgRating);
  const [feedbackCount, setFeedbackCount] = useState(initialFeedbackCount);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/api/syntheses/by-id/${synthesisId}/feedback`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, comment: comment.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAvgRating(data.avgRating || avgRating);
      setFeedbackCount(data.feedbackCount || feedbackCount + 1);
      setSubmitted(true);
    } catch {
      setError('Erreur lors de l\'envoi. Reessayez.');
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, synthesisId, avgRating, feedbackCount]);

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.thankYou}>
          <span style={{ fontSize: '20px' }}>&#10003;</span>
          <span>Merci pour votre retour !</span>
        </div>
        {avgRating > 0 && (
          <p style={styles.avgText}>
            Note moyenne : {avgRating.toFixed(1)}/5 ({feedbackCount} avis)
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Votre avis sur cette synthese</h3>
        {avgRating > 0 && (
          <span style={styles.existingRating}>
            {avgRating.toFixed(1)}/5 ({feedbackCount})
          </span>
        )}
      </div>

      {/* Star Rating */}
      <div style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            style={{
              ...styles.starButton,
              color: star <= (hoveredStar || rating) ? '#F59E0B' : '#D1D5DB',
            }}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            aria-label={`${star} etoile${star > 1 ? 's' : ''}`}
          >
            &#9733;
          </button>
        ))}
        {rating > 0 && (
          <span style={styles.ratingLabel}>
            {rating === 1 && 'Insuffisant'}
            {rating === 2 && 'Mediocre'}
            {rating === 3 && 'Correct'}
            {rating === 4 && 'Bien'}
            {rating === 5 && 'Excellent'}
          </span>
        )}
      </div>

      {/* Optional Comment */}
      {rating > 0 && (
        <>
          <textarea
            style={styles.textarea}
            placeholder="Un commentaire ? (optionnel)"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            maxLength={500}
            rows={2}
          />
          <div style={styles.actions}>
            <button
              type="button"
              style={{
                ...styles.submitButton,
                opacity: submitting ? 0.6 : 1,
              }}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Envoi...' : 'Envoyer'}
            </button>
            {comment.length > 0 && (
              <span style={styles.charCount}>{comment.length}/500</span>
            )}
          </div>
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    marginTop: '32px',
    padding: '24px',
    borderTop: '2px solid #000000',
    backgroundColor: '#F9FAFB',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
  },
  existingRating: {
    fontSize: '13px',
    color: '#6B7280',
  },
  starsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '12px',
  },
  starButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '28px',
    padding: '2px',
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  ratingLabel: {
    marginLeft: '12px',
    fontSize: '13px',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #E5E5E5',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    resize: 'vertical' as const,
    backgroundColor: '#FFFFFF',
    color: '#000000',
    boxSizing: 'border-box' as const,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px',
  },
  submitButton: {
    padding: '8px 24px',
    backgroundColor: '#000000',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
  },
  charCount: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  error: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#DC2626',
  },
  thankYou: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#059669',
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    fontWeight: 600,
  },
  avgText: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#6B7280',
  },
};
