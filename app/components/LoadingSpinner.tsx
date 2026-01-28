"use client";

import { memo } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  darkMode?: boolean;
  text?: string;
}

const LoadingSpinner = memo(function LoadingSpinner({ 
  size = 'medium',
  darkMode = false,
  text
}: LoadingSpinnerProps) {
  const sizes = {
    small: 20,
    medium: 40,
    large: 60
  };

  const spinnerSize = sizes[size];
  const color = darkMode ? '#ffffff' : '#000000';
  const bgColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      gap: '12px'
    }}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{
        width: `${spinnerSize}px`,
        height: `${spinnerSize}px`,
        border: `3px solid ${bgColor}`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      
      {text && (
        <p style={{
          fontSize: size === 'small' ? '12px' : '14px',
          color: darkMode ? '#a3a3a3' : '#6b7280',
          margin: 0
        }}>
          {text}
        </p>
      )}
    </div>
  );
});

export default LoadingSpinner;