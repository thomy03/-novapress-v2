'use client';

import Link from 'next/link';
import TransparencyBadge from '@/app/components/xray/TransparencyBadge';

export default function LandingPage() {
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
            L'IA qui desose l'information
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
        <div style={styles.stepsGrid}>
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
            <h3 style={styles.stepTitle}>L'IA croise et verifie</h3>
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
              Vous savez exactement comment l'information est fabriquee.
            </p>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section style={{ ...styles.section, backgroundColor: '#F9FAFB' }}>
        <h2 style={styles.sectionTitle}>Ce qui nous differencie</h2>
        <div style={styles.diffGrid}>
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
              Visualisation interactive des relations cause-effet dans l'actualite.
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

      {/* CTA */}
      <section style={{ ...styles.section, textAlign: 'center' as const }}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '16px' }}>
          Pret a voir l'information autrement ?
        </h2>
        <p style={{ fontSize: '16px', color: '#6B7280', fontFamily: 'Georgia, serif', marginBottom: '32px' }}>
          Commencez par le Morning Brief quotidien, ou explorez les dernieres syntheses.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' as const }}>
          <Link href="/brief" style={styles.primaryButton}>
            Morning Brief
          </Link>
          <Link href="/" style={styles.secondaryButton}>
            Page d'accueil
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerLogo}>
            <span style={{ fontWeight: 'bold' }}>NOVA</span>
            <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
            <span style={{ fontSize: '12px', color: '#2563EB', marginLeft: '3px', fontWeight: 'bold' }}>AI</span>
          </div>
          <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
            Transformer le chaos informationnel en intelligence journalistique via l'IA.
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
};
