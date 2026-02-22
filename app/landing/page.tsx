'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import TransparencyBadge from '@/app/components/xray/TransparencyBadge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function LandingPage() {
  // Waitlist form state
  const [email, setEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistCount, setWaitlistCount] = useState(247);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch waitlist count on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/waitlist/count`)
      .then(res => res.json())
      .then(data => {
        if (data.count) setWaitlistCount(data.count);
      })
      .catch(() => {
        // Fallback: use seed count, already set
      });
  }, []);

  const handleWaitlistSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setWaitlistStatus('loading');

    try {
      const res = await fetch(`${API_BASE}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'landing' }),
      });

      const data = await res.json();

      if (data.success) {
        setWaitlistStatus('success');
        if (data.position) setWaitlistCount(data.position);
      } else {
        // Fallback to localStorage if API fails
        throw new Error(data.error || 'API error');
      }
    } catch {
      // localStorage fallback
      try {
        const stored = JSON.parse(localStorage.getItem('novapress_waitlist') || '[]');
        if (!stored.includes(email.trim())) {
          stored.push(email.trim());
          localStorage.setItem('novapress_waitlist', JSON.stringify(stored));
        }
        setWaitlistStatus('success');
        setWaitlistCount(prev => prev + 1);
      } catch {
        setWaitlistStatus('error');
      }
    }
  }, [email]);

  const scrollToWaitlist = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById('waitlist');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.logoLarge}>
            <span style={{ fontWeight: 'bold', color: '#000' }}>NOVA</span>
            <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
            <span style={{ fontSize: '24px', color: '#2563EB', marginLeft: '6px', fontWeight: 'bold' }}>AI</span>
          </div>

          <h1 style={styles.heroTitle}>
            L&apos;IA qui desose l&apos;information
          </h1>

          <p style={styles.heroSubtitle}>
            NovaPress croise 53+ sources mondiales, detecte les contradictions,
            mesure la transparence et vous montre ce que personne ne vous montre.
          </p>

          <div style={styles.heroCTA}>
            <Link href="/brief" style={styles.primaryButton}>
              Voir le Morning Brief
            </Link>
            <Link href="/" style={styles.secondaryButton}>
              Explorer les syntheses
            </Link>
          </div>
        </div>

        {/* Demo X-Ray card */}
        <div style={styles.demoCard}>
          <div style={styles.demoLabel}>EXEMPLE EN DIRECT</div>
          <div style={styles.demoContent}>
            <TransparencyBadge score={78} label="Bon" size="large" />
            <div style={styles.demoText}>
              <div style={styles.demoTitle}>Score de Transparence</div>
              <div style={styles.demoDesc}>
                Chaque synthese recoit un score base sur la diversite des sources,
                les contradictions detectees et la couverture geographique.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ height: '3px', backgroundColor: '#000' }} />
      </div>

      {/* How it Works */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Comment ca marche</h2>
        <div style={{
          ...styles.stepsGrid,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        }}>
          <div style={styles.step}>
            <div style={styles.stepNumber}>1</div>
            <h3 style={styles.stepTitle}>53+ sources analysees</h3>
            <p style={styles.stepDesc}>
              Presse francaise, americaine, britannique, allemande, espagnole,
              italienne. Plus Reddit, Hacker News, ArXiv et Wikipedia.
            </p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepNumber}>2</div>
            <h3 style={styles.stepTitle}>L&apos;IA croise et verifie</h3>
            <p style={styles.stepDesc}>
              Clustering semantique, detection de contradictions entre sources,
              analyse de densite factuelle et graphe causal automatique.
            </p>
          </div>
          <div style={styles.step}>
            <div style={styles.stepNumber}>3</div>
            <h3 style={styles.stepTitle}>Vous voyez tout</h3>
            <p style={styles.stepDesc}>
              Score de transparence, X-Ray des sources, angles morts identifies.
              Vous savez exactement comment l&apos;information est fabriquee.
            </p>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section style={{ ...styles.section, backgroundColor: '#F9FAFB' }}>
        <h2 style={styles.sectionTitle}>Ce qui nous differencie</h2>
        <div style={{
          ...styles.diffGrid,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        }}>
          <div style={styles.diffItem}>
            <div style={styles.diffLabel}>Transparency Score</div>
            <p style={styles.diffDesc}>
              Un score unique 0-100 qui mesure la qualite de couverture de chaque synthese.
              Base sur 5 criteres objectifs et verifiables.
            </p>
          </div>
          <div style={styles.diffItem}>
            <div style={styles.diffLabel}>News X-Ray</div>
            <p style={styles.diffDesc}>
              Radiographie complete de chaque synthese : quelles sources couvrent le sujet,
              quels angles sont ignores, ou sont les contradictions.
            </p>
          </div>
          <div style={styles.diffItem}>
            <div style={styles.diffLabel}>Graphe Causal</div>
            <p style={styles.diffDesc}>
              Visualisation interactive des relations cause-effet dans l&apos;actualite.
              Comprenez les mecanismes, pas seulement les evenements.
            </p>
          </div>
          <div style={styles.diffItem}>
            <div style={styles.diffLabel}>Multi-Personas</div>
            <p style={styles.diffDesc}>
              La meme info racontee par 4 voix differentes : factuel, cynique,
              optimiste ou narratif. Changez de perspective en un clic.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Nos offres</h2>
        <div style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
          maxWidth: '960px',
          margin: '0 auto',
        }}>
          {/* FREE Tier */}
          <div style={styles.pricingCard}>
            <div style={styles.pricingTierName}>FREE</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingAmount}>$0</span>
            </div>
            <div style={styles.pricingDivider} />
            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeature}>5 syntheses/jour</li>
              <li style={styles.pricingFeature}>Persona neutre</li>
              <li style={styles.pricingFeature}>Breaking news ticker</li>
              <li style={styles.pricingFeature}>Page d&apos;accueil</li>
            </ul>
            <Link href="/" style={styles.pricingButtonOutline}>
              Commencer gratuitement
            </Link>
          </div>

          {/* PRO Tier */}
          <div style={{
            ...styles.pricingCard,
            border: '2px solid #000',
            position: 'relative' as const,
            transform: isMobile ? 'none' : 'translateY(-8px)',
          }}>
            <div style={styles.pricingBadge}>RECOMMANDE</div>
            <div style={styles.pricingTierName}>PRO</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingAmount}>$4.99</span>
              <span style={styles.pricingPeriod}>/mois</span>
            </div>
            <div style={styles.pricingDivider} />
            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeature}>Tout illimite</li>
              <li style={styles.pricingFeature}>18 personas</li>
              <li style={styles.pricingFeature}>Graphes causaux</li>
              <li style={styles.pricingFeature}>Timeline historique</li>
              <li style={styles.pricingFeature}>Audio briefing</li>
              <li style={styles.pricingFeature}>Alertes Telegram</li>
              <li style={styles.pricingFeature}>Recherche semantique</li>
              <li style={styles.pricingFeature}>Bookmarks</li>
            </ul>
            <a href="#waitlist" onClick={scrollToWaitlist} style={styles.pricingButtonFilled}>
              Demarrer l&apos;essai gratuit
            </a>
          </div>

          {/* ENTERPRISE Tier */}
          <div style={styles.pricingCard}>
            <div style={styles.pricingTierName}>ENTERPRISE</div>
            <div style={styles.pricingPrice}>
              <span style={styles.pricingAmount}>Sur devis</span>
            </div>
            <div style={styles.pricingDivider} />
            <ul style={styles.pricingFeatures}>
              <li style={styles.pricingFeature}>Tout de Pro +</li>
              <li style={styles.pricingFeature}>Acces API</li>
              <li style={styles.pricingFeature}>Sources personnalisees</li>
              <li style={styles.pricingFeature}>Personas sur mesure</li>
              <li style={styles.pricingFeature}>White-label</li>
              <li style={styles.pricingFeature}>SLA 99.9%</li>
              <li style={styles.pricingFeature}>Support dedie</li>
            </ul>
            <a href="mailto:contact@novapress.ai" style={styles.pricingButtonOutline}>
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={styles.statsBar}>
        <div style={styles.stat}>
          <div style={styles.statNumber}>53+</div>
          <div style={styles.statLabel}>Sources mondiales</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>6</div>
          <div style={styles.statLabel}>Langues analysees</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>24/7</div>
          <div style={styles.statLabel}>Pipeline IA actif</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNumber}>100%</div>
          <div style={styles.statLabel}>Open source</div>
        </div>
      </section>

      {/* Waitlist Form */}
      <section id="waitlist" style={{
        ...styles.section,
        textAlign: 'center' as const,
        borderBottom: '1px solid #E5E5E5',
      }}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '12px' }}>
          Rejoignez la beta privee
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          fontFamily: 'Georgia, serif',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Soyez parmi les premiers a acceder a NovaPress AI. Places limitees.
        </p>

        {waitlistStatus === 'success' ? (
          <div style={{
            padding: '20px 24px',
            border: '1px solid #000',
            maxWidth: '500px',
            margin: '0 auto 16px',
            fontFamily: 'Georgia, serif',
            fontSize: '15px',
            color: '#000',
          }}>
            Vous etes inscrit ! Nous vous contacterons bientot.
          </div>
        ) : (
          <form
            onSubmit={handleWaitlistSubmit}
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0',
              maxWidth: '500px',
              margin: '0 auto 16px',
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setWaitlistStatus('idle'); }}
              placeholder="votre@email.com"
              required
              style={{
                flex: 1,
                padding: '14px 16px',
                border: '1px solid #000',
                borderRight: isMobile ? '1px solid #000' : 'none',
                fontFamily: 'Georgia, serif',
                fontSize: '15px',
                color: '#000',
                backgroundColor: '#FFF',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              type="submit"
              disabled={waitlistStatus === 'loading'}
              style={{
                padding: '14px 28px',
                backgroundColor: '#000',
                color: '#FFF',
                border: '1px solid #000',
                fontFamily: 'Georgia, serif',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: waitlistStatus === 'loading' ? 'wait' : 'pointer',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                opacity: waitlistStatus === 'loading' ? 0.7 : 1,
              }}
            >
              {waitlistStatus === 'loading' ? '...' : "S'inscrire"}
            </button>
          </form>
        )}

        {waitlistStatus === 'error' && (
          <p style={{
            fontSize: '14px',
            color: '#DC2626',
            fontFamily: 'Georgia, serif',
            marginBottom: '8px',
          }}>
            Une erreur est survenue. Reessayez.
          </p>
        )}

        <p style={{
          fontSize: '13px',
          color: '#9CA3AF',
          fontFamily: 'Georgia, serif',
        }}>
          Deja {waitlistCount} inscrits
        </p>
      </section>

      {/* CTA */}
      <section style={{ ...styles.section, textAlign: 'center' as const }}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '16px' }}>
          Pret a voir l&apos;information autrement ?
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          fontFamily: 'Georgia, serif',
          marginBottom: '32px',
          lineHeight: 1.6,
        }}>
          Inscrivez-vous a la beta privee et commencez gratuitement.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          <a href="#waitlist" onClick={scrollToWaitlist} style={styles.primaryButton}>
            Rejoindre la beta
          </a>
          <Link href="/brief" style={styles.secondaryButton}>
            Morning Brief
          </Link>
          <Link href="/" style={styles.secondaryButton}>
            Page d&apos;accueil
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={{
          ...styles.footerContent,
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={styles.footerLogo}>
              <span style={{ fontWeight: 'bold' }}>NOVA</span>
              <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
              <span style={{ fontSize: '12px', color: '#2563EB', marginLeft: '3px', fontWeight: 'bold' }}>AI</span>
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
              Transformer le chaos informationnel en intelligence journalistique via l&apos;IA.
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            flexWrap: 'wrap',
            width: '100%',
            borderTop: '1px solid #E5E5E5',
            paddingTop: '16px',
          }}>
            <Link href="/terms" style={styles.footerLink}>
              Conditions d&apos;utilisation
            </Link>
            <Link href="/privacy" style={styles.footerLink}>
              Politique de confidentialite
            </Link>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#9CA3AF',
            fontFamily: 'Georgia, serif',
          }}>
            &copy; 2026 NovaPress AI. Tous droits reserves.
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hero: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '80px 24px 60px',
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
  },
  heroContent: {
    textAlign: 'center',
  },
  logoLarge: {
    fontSize: '40px',
    fontFamily: 'Georgia, serif',
    marginBottom: '24px',
    letterSpacing: '-0.5px',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    lineHeight: 1.2,
    marginBottom: '16px',
    letterSpacing: '-1px',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: '#4B5563',
    fontFamily: 'Georgia, serif',
    lineHeight: 1.6,
    maxWidth: '600px',
    margin: '0 auto 32px',
  },
  heroCTA: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '14px 32px',
    backgroundColor: '#000',
    color: '#FFF',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '15px',
    fontFamily: 'Georgia, serif',
    letterSpacing: '0.5px',
  },
  secondaryButton: {
    padding: '14px 32px',
    backgroundColor: '#FFF',
    color: '#000',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '15px',
    fontFamily: 'Georgia, serif',
    border: '1px solid #000',
    letterSpacing: '0.5px',
  },
  demoCard: {
    border: '1px solid #E5E5E5',
    padding: '24px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  demoLabel: {
    fontSize: '10px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: '#DC2626',
    marginBottom: '16px',
  },
  demoContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  demoText: {
    flex: 1,
  },
  demoTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    marginBottom: '4px',
  },
  demoDesc: {
    fontSize: '13px',
    color: '#6B7280',
    lineHeight: 1.5,
  },
  section: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '60px 24px',
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    textAlign: 'center',
    marginBottom: '40px',
    letterSpacing: '-0.5px',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '32px',
  },
  step: {
    textAlign: 'center',
  },
  stepNumber: {
    fontSize: '48px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#DC2626',
    lineHeight: 1,
    marginBottom: '12px',
  },
  stepTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    marginBottom: '8px',
  },
  stepDesc: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: 1.6,
  },
  diffGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '24px',
  },
  diffItem: {
    padding: '24px',
    border: '1px solid #E5E5E5',
    backgroundColor: '#FFF',
  },
  diffLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: '#2563EB',
    marginBottom: '8px',
  },
  diffDesc: {
    fontSize: '14px',
    color: '#4B5563',
    lineHeight: 1.6,
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: '48px',
    padding: '40px 24px',
    borderTop: '1px solid #E5E5E5',
    borderBottom: '1px solid #E5E5E5',
    flexWrap: 'wrap',
  },
  stat: {
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '36px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  footer: {
    borderTop: '3px solid #000',
    padding: '32px 24px',
  },
  footerContent: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  footerLogo: {
    fontSize: '20px',
    fontFamily: 'Georgia, serif',
  },
  footerLink: {
    fontSize: '13px',
    color: '#6B7280',
    textDecoration: 'none',
    fontFamily: 'Georgia, serif',
  },

  // Pricing styles
  pricingCard: {
    flex: 1,
    minWidth: '240px',
    maxWidth: '300px',
    border: '1px solid #E5E5E5',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  pricingBadge: {
    position: 'absolute',
    top: '-12px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#DC2626',
    color: '#FFF',
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '1.5px',
    padding: '4px 14px',
    fontFamily: 'Georgia, serif',
    whiteSpace: 'nowrap',
  },
  pricingTierName: {
    fontSize: '13px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontFamily: 'Georgia, serif',
    marginBottom: '12px',
  },
  pricingPrice: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '4px',
  },
  pricingAmount: {
    fontSize: '36px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
  },
  pricingPeriod: {
    fontSize: '14px',
    color: '#6B7280',
    fontFamily: 'Georgia, serif',
  },
  pricingDivider: {
    width: '100%',
    height: '1px',
    backgroundColor: '#E5E5E5',
    marginBottom: '20px',
  },
  pricingFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
    width: '100%',
  },
  pricingFeature: {
    fontSize: '14px',
    color: '#4B5563',
    fontFamily: 'Georgia, serif',
    lineHeight: 1.6,
    padding: '4px 0',
    borderBottom: '1px solid #F3F4F6',
    textAlign: 'center',
  },
  pricingButtonFilled: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#000',
    color: '#FFF',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    letterSpacing: '0.5px',
    textAlign: 'center',
    border: '1px solid #000',
    cursor: 'pointer',
    marginTop: 'auto',
  },
  pricingButtonOutline: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#FFF',
    color: '#000',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    letterSpacing: '0.5px',
    textAlign: 'center',
    border: '1px solid #000',
    cursor: 'pointer',
    marginTop: 'auto',
  },
};
