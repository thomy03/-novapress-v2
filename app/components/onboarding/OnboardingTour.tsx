'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'novapress_onboarding_completed';

interface TourStep {
  title: string;
  description: string;
  target: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Score de Transparence',
    description: 'Chaque synthese recoit un score 0-100 mesurant la qualite de la couverture : nombre de sources, langues, contradictions detectees.',
    target: 'transparency',
  },
  {
    title: 'News X-Ray',
    description: 'Cliquez sur "NEWS X-RAY" pour voir la radiographie complete : quelles sources couvrent le sujet, quels angles sont ignores.',
    target: 'xray',
  },
  {
    title: 'Morning Brief',
    description: 'Chaque jour, les 5 syntheses les plus transparentes vous attendent dans le Morning Brief. Votre ritual d\'info quotidien.',
    target: 'brief',
  },
];

export default function OnboardingTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const completed = localStorage.getItem(STORAGE_KEY);
      if (!completed) {
        setIsVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Progress */}
        <div style={styles.progress}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.progressDot,
                backgroundColor: i <= currentStep ? '#2563EB' : '#E5E5E5',
              }}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div style={styles.stepIndicator}>
          {currentStep + 1} / {TOUR_STEPS.length}
        </div>

        {/* Content */}
        <h3 style={styles.title}>{step.title}</h3>
        <p style={styles.description}>{step.description}</p>

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={handleClose} style={styles.skipButton}>
            Passer
          </button>
          <button onClick={handleNext} style={styles.nextButton}>
            {currentStep < TOUR_STEPS.length - 1 ? 'Suivant' : 'Compris !'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '24px',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    maxWidth: '420px',
    width: '100%',
    padding: '32px',
    position: 'relative',
  },
  progress: {
    display: 'flex',
    gap: '6px',
    marginBottom: '24px',
  },
  progressDot: {
    flex: 1,
    height: '3px',
    transition: 'background-color 0.3s',
  },
  stepIndicator: {
    fontSize: '11px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    marginBottom: '8px',
  },
  description: {
    fontSize: '15px',
    color: '#4B5563',
    lineHeight: 1.6,
    marginBottom: '24px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontSize: '14px',
  },
  nextButton: {
    padding: '10px 24px',
    backgroundColor: '#000',
    color: '#FFF',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
  },
};
