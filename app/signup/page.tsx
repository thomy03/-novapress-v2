'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    border: '1px solid #E5E5E5',
    padding: '40px 32px',
    backgroundColor: '#FFF',
  },
  logo: {
    fontSize: '24px',
    fontFamily: 'Georgia, serif',
    textAlign: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    textAlign: 'center',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: '32px',
  },
  divider: {
    height: '2px',
    backgroundColor: '#000',
    marginBottom: '32px',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 'bold',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #E5E5E5',
    fontSize: '15px',
    fontFamily: 'Georgia, serif',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#000',
    color: '#FFF',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    marginTop: '8px',
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
    cursor: 'not-allowed',
  },
  error: {
    color: '#DC2626',
    fontSize: '13px',
    marginTop: '12px',
    textAlign: 'center',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#6B7280',
  },
  link: {
    color: '#2563EB',
    textDecoration: 'none',
  },
};

function mapErrorMessage(message: string): string {
  if (message.includes('already exists')) {
    return 'Un compte existe deja avec cet email.';
  }
  if (message.includes('Invalid credentials')) {
    return 'Email ou mot de passe incorrect.';
  }
  return 'Une erreur est survenue. Veuillez reessayer.';
}

export default function SignupPage() {
  const router = useRouter();
  const { signup, user, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    try {
      await signup(name, email, password);
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(mapErrorMessage(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={{ fontWeight: 'bold', color: '#000' }}>NOVA</span>
          <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
          {' '}
          <span style={{ fontWeight: 'bold', color: '#2563EB' }}>AI</span>
        </div>

        <h1 style={styles.title}>Creer un compte</h1>
        <p style={styles.subtitle}>Rejoignez NovaPress AI &mdash; Acces gratuit</p>

        <div style={styles.divider} />

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.fieldGroup}>
            <label htmlFor="name" style={styles.label}>
              Nom
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="email" style={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Minimum 8 caracteres"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="confirmPassword" style={styles.label}>
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repetez votre mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? 'Inscription...' : "S'inscrire"}
          </button>

          {error && <p style={styles.error}>{error}</p>}
        </form>

        <div style={styles.footer}>
          <p style={{ margin: '0 0 8px 0' }}>
            Deja un compte ?{' '}
            <Link href="/login" style={styles.link}>
              Se connecter
            </Link>
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/" style={styles.link}>
              Retour a l&apos;accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
