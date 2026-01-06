'use client';

import React from 'react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: 'default' | 'minimal' | 'fullpage';
  icon?: React.ReactNode;
}

/**
 * Unified Error State Component
 * Consistent error display across the application
 */
export function ErrorState({
  title = 'Erreur',
  message,
  onRetry,
  retryLabel = 'Réessayer',
  variant = 'default',
  icon,
}: ErrorStateProps) {
  const styles = {
    default: {
      container: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        backgroundColor: '#FEF2F2',
        borderRadius: '8px',
        border: '1px solid #FECACA',
        textAlign: 'center' as const,
      },
      icon: {
        fontSize: '48px',
        marginBottom: '16px',
      },
      title: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#991B1B',
        margin: '0 0 8px 0',
      },
      message: {
        fontSize: '14px',
        color: '#DC2626',
        margin: '0 0 20px 0',
        maxWidth: '400px',
      },
    },
    minimal: {
      container: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#FEF2F2',
        borderRadius: '6px',
        border: '1px solid #FECACA',
      },
      icon: {
        fontSize: '20px',
      },
      title: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#991B1B',
        margin: 0,
      },
      message: {
        fontSize: '13px',
        color: '#DC2626',
        margin: 0,
      },
    },
    fullpage: {
      container: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '40px 20px',
        textAlign: 'center' as const,
      },
      icon: {
        fontSize: '64px',
        marginBottom: '24px',
      },
      title: {
        fontSize: '24px',
        fontWeight: '700',
        color: '#991B1B',
        margin: '0 0 12px 0',
      },
      message: {
        fontSize: '16px',
        color: '#6B7280',
        margin: '0 0 24px 0',
        maxWidth: '500px',
      },
    },
  };

  const currentStyles = styles[variant];

  return (
    <div style={currentStyles.container}>
      <div style={currentStyles.icon}>
        {icon || '❌'}
      </div>
      {variant !== 'minimal' && (
        <h2 style={currentStyles.title}>{title}</h2>
      )}
      <p style={currentStyles.message}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-hover-danger"
          style={{
            padding: variant === 'minimal' ? '6px 12px' : '10px 20px',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontSize: variant === 'minimal' ? '12px' : '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// Preset variants for common use cases
export function NotFoundError({ onBack }: { onBack?: () => void }) {
  return (
    <ErrorState
      variant="fullpage"
      icon="🔍"
      title="Page introuvable"
      message="La page que vous recherchez n'existe pas ou a été déplacée."
      onRetry={onBack}
      retryLabel="Retour"
    />
  );
}

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      variant="default"
      icon="📡"
      title="Erreur de connexion"
      message="Impossible de se connecter au serveur. Vérifiez votre connexion internet."
      onRetry={onRetry}
    />
  );
}

export function ServerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      variant="default"
      icon="⚠️"
      title="Erreur serveur"
      message="Une erreur s'est produite sur le serveur. Veuillez réessayer plus tard."
      onRetry={onRetry}
    />
  );
}

export default ErrorState;
