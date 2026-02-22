'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Back link */}
        <Link href="/" style={styles.backLink}>
          &larr; Retour a l'accueil
        </Link>

        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logo}>
            <span style={{ fontWeight: 'bold', color: '#000' }}>NOVA</span>
            <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
            <span style={{ fontSize: '14px', color: '#2563EB', marginLeft: '4px', fontWeight: 'bold' }}>AI</span>
          </div>
          <h1 style={styles.title}>Conditions Generales d'Utilisation</h1>
          <p style={styles.updated}>Derniere mise a jour : Fevrier 2026</p>
        </header>

        <div style={styles.divider} />

        {/* Section 1 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Presentation du service</h2>
          <p style={styles.paragraph}>
            NovaPress AI est une plateforme d'intelligence journalistique utilisant
            l'intelligence artificielle pour agreger, analyser et synthetiser l'actualite
            mondiale a partir de plus de 53 sources de presse internationale et 5 sources
            alternatives (Reddit, Hacker News, ArXiv, Wikipedia, Bluesky).
          </p>
          <p style={styles.paragraph}>
            Le service est edite par NovaPress AI (ci-apres "NovaPress", "nous" ou "notre").
            En accedant au service, vous acceptez les presentes conditions generales
            d'utilisation dans leur integralite.
          </p>
        </section>

        {/* Section 2 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>2. Conditions d'utilisation</h2>

          <h3 style={styles.subsectionTitle}>2.1 Acces au service</h3>
          <p style={styles.paragraph}>
            L'acces a NovaPress est gratuit dans sa version de base, avec les limitations
            suivantes :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>5 syntheses completes par jour</li>
            <li style={styles.listItem}>Acces au Score de Transparence en mode apercu</li>
            <li style={styles.listItem}>Historique limite a 7 jours</li>
          </ul>

          <h3 style={styles.subsectionTitle}>2.2 Abonnements</h3>
          <p style={styles.paragraph}>
            Des offres d'abonnement Pro et Enterprise sont disponibles pour un acces
            etendu au service, incluant des syntheses illimitees, l'acces complet au
            graphe causal, au Time-Traveler et aux personas editoriales.
          </p>

          <h3 style={styles.subsectionTitle}>2.3 Usages interdits</h3>
          <p style={styles.paragraph}>
            Il est strictement interdit de :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              Utiliser le contenu de NovaPress a des fins commerciales sans accord
              prealable ecrit
            </li>
            <li style={styles.listItem}>
              Proceder au scraping, a la copie automatisee ou a l'extraction
              systematique du contenu
            </li>
            <li style={styles.listItem}>
              Contourner les limitations d'acces ou les mesures de securite du service
            </li>
            <li style={styles.listItem}>
              Redistribuer les syntheses sans attribution a NovaPress AI
            </li>
          </ul>
        </section>

        {/* Section 3 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>3. Contenu genere par intelligence artificielle</h2>

          <h3 style={styles.subsectionTitle}>3.1 Nature du contenu</h3>
          <p style={styles.paragraph}>
            Les syntheses publiees sur NovaPress sont generees par intelligence artificielle
            a partir de sources de presse publiques. Elles constituent des oeuvres derivees
            produites par un processus automatise de collecte, d'analyse et de reformulation.
          </p>

          <h3 style={styles.subsectionTitle}>3.2 Exactitude des informations</h3>
          <p style={styles.paragraph}>
            NovaPress s'efforce de fournir des syntheses fiables et factuelles. Toutefois,
            en raison de la nature automatisee du traitement, nous ne pouvons garantir
            l'exactitude absolue de toutes les informations presentees. Les utilisateurs
            sont invites a consulter les sources originales, qui sont systematiquement
            citees et accessibles via les liens fournis.
          </p>

          <h3 style={styles.subsectionTitle}>3.3 Score de Transparence</h3>
          <p style={styles.paragraph}>
            Le Score de Transparence est un indicateur algorithmique base sur cinq criteres
            (diversite des sources, objectivite du langage, detection de contradictions,
            densite factuelle, couverture geographique). Ce score est fourni a titre
            indicatif et ne constitue en aucun cas une garantie contractuelle de qualite
            ou de fiabilite de l'information.
          </p>
        </section>

        {/* Section 4 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>4. Propriete intellectuelle</h2>

          <p style={styles.paragraph}>
            Le contenu original des articles sources reste la propriete exclusive de
            leurs editeurs respectifs. NovaPress ne revendique aucun droit sur le contenu
            original des sources agregees.
          </p>
          <p style={styles.paragraph}>
            Les syntheses generees par NovaPress AI constituent des oeuvres derivees
            protegees par le droit de la propriete intellectuelle. Leur reproduction,
            distribution ou modification est soumise a autorisation.
          </p>
          <p style={styles.paragraph}>
            L'utilisateur conserve l'integralite de ses droits sur ses donnees personnelles,
            ses preferences et les contenus qu'il produit dans le cadre de l'utilisation
            du service (commentaires, favoris, parametrages).
          </p>
        </section>

        {/* Section 5 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>5. Abonnements et paiement</h2>

          <h3 style={styles.subsectionTitle}>5.1 Modalites de paiement</h3>
          <p style={styles.paragraph}>
            Les paiements sont traites de maniere securisee par Stripe. NovaPress
            n'a jamais acces a vos informations bancaires completes.
          </p>

          <h3 style={styles.subsectionTitle}>5.2 Facturation</h3>
          <p style={styles.paragraph}>
            La facturation est effectuee sur une base mensuelle ou annuelle, selon
            l'offre choisie. L'abonnement est renouvele automatiquement a chaque
            echeance, sauf annulation prealable par l'utilisateur depuis son espace
            personnel.
          </p>

          <h3 style={styles.subsectionTitle}>5.3 Droit de retractation</h3>
          <p style={styles.paragraph}>
            Conformement a la legislation europeenne, vous disposez d'un delai de
            14 jours a compter de la souscription pour exercer votre droit de
            retractation et obtenir un remboursement integral, sans justification.
            Pour exercer ce droit, contactez-nous a{' '}
            <a href="mailto:support@novapress.ai" style={styles.link}>support@novapress.ai</a>.
          </p>
        </section>

        {/* Section 6 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>6. Limitation de responsabilite</h2>

          <p style={styles.paragraph}>
            Le service NovaPress est fourni "en l'etat" ("as is"), sans garantie
            d'aucune sorte, expresse ou implicite.
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              NovaPress ne garantit pas une disponibilite ininterrompue du service.
              Des interruptions pour maintenance ou mise a jour peuvent survenir.
            </li>
            <li style={styles.listItem}>
              NovaPress ne saurait etre tenu responsable des decisions prises par
              les utilisateurs sur la base du contenu publie sur la plateforme.
            </li>
            <li style={styles.listItem}>
              La responsabilite de NovaPress est limitee au montant de l'abonnement
              verse par l'utilisateur au cours des 12 derniers mois.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>7. Modification des conditions</h2>

          <p style={styles.paragraph}>
            NovaPress se reserve le droit de modifier les presentes conditions generales
            d'utilisation a tout moment. En cas de modification substantielle, les
            utilisateurs seront informes par email au moins 30 jours avant l'entree
            en vigueur des nouvelles conditions.
          </p>
          <p style={styles.paragraph}>
            La poursuite de l'utilisation du service apres l'entree en vigueur des
            modifications vaut acceptation des nouvelles conditions.
          </p>
        </section>

        {/* Section 8 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>8. Droit applicable et juridiction</h2>

          <p style={styles.paragraph}>
            Les presentes conditions sont regies par le droit francais. Tout litige
            relatif a l'interpretation ou a l'execution des presentes conditions
            sera soumis a la competence exclusive des tribunaux de Paris, sauf
            disposition legale contraire applicable au consommateur.
          </p>
        </section>

        {/* Section 9 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>9. Contact</h2>

          <p style={styles.paragraph}>
            Pour toute question relative aux presentes conditions, vous pouvez
            nous contacter a l'adresse suivante :
          </p>
          <p style={styles.paragraph}>
            <strong>NovaPress AI</strong><br />
            Email :{' '}
            <a href="mailto:contact@novapress.ai" style={styles.link}>contact@novapress.ai</a>
          </p>
        </section>

        <div style={styles.divider} />

        {/* Footer links */}
        <footer style={styles.footer}>
          <Link href="/privacy" style={styles.footerLink}>
            Politique de confidentialite
          </Link>
          <span style={styles.footerSeparator}>|</span>
          <Link href="/" style={styles.footerLink}>
            Accueil
          </Link>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
    padding: '40px 24px 80px 24px',
  },
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  backLink: {
    display: 'inline-block',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#6B7280',
    textDecoration: 'none',
    marginBottom: '32px',
  },
  header: {
    marginBottom: '32px',
  },
  logo: {
    fontFamily: 'Georgia, serif',
    fontSize: '20px',
    marginBottom: '24px',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '36px',
    fontWeight: 700,
    color: '#000000',
    lineHeight: 1.2,
    margin: '0 0 12px 0',
  },
  updated: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#6B7280',
    margin: 0,
  },
  divider: {
    height: '2px',
    backgroundColor: '#000000',
    margin: '32px 0',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '22px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 16px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #E5E5E5',
  },
  subsectionTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '17px',
    fontWeight: 700,
    color: '#000000',
    margin: '24px 0 8px 0',
  },
  paragraph: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#000000',
    margin: '0 0 16px 0',
  },
  list: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    lineHeight: 1.8,
    color: '#000000',
    margin: '0 0 16px 0',
    paddingLeft: '24px',
  },
  listItem: {
    marginBottom: '8px',
  },
  link: {
    color: '#2563EB',
    textDecoration: 'none',
  },
  footer: {
    textAlign: 'center' as const,
    paddingTop: '16px',
  },
  footerLink: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#6B7280',
    textDecoration: 'none',
  },
  footerSeparator: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#E5E5E5',
    margin: '0 12px',
  },
};
