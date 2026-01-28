'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F9FAFB',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '600px',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              padding: '24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                Une erreur est survenue
              </h1>
            </div>

            {/* Content */}
            <div style={{ padding: '24px' }}>
              <p style={{
                color: '#374151',
                fontSize: '16px',
                marginBottom: '16px',
                lineHeight: '1.6',
              }}>
                Nous sommes désolés, quelque chose s&apos;est mal passé.
                L&apos;équipe technique a été notifiée.
              </p>

              {/* Error details (dev mode) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{
                  backgroundColor: '#FEE2E2',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '16px',
                }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    color: '#991B1B',
                  }}>
                    Détails de l&apos;erreur (dev)
                  </summary>
                  <pre style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#7F1D1D',
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={this.handleReset}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Réessayer
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    backgroundColor: '#F3F4F6',
                    color: '#374151',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Retour à l&apos;accueil
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              backgroundColor: '#F9FAFB',
              padding: '16px 24px',
              borderTop: '1px solid #E5E7EB',
              textAlign: 'center',
            }}>
              <span style={{ color: '#6B7280', fontSize: '12px' }}>
                NovaPress AI v2.0
              </span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
