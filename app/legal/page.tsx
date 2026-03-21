'use client';

import Link from 'next/link';

export default function LegalPage() {
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
          <h1 style={styles.title}>Mentions Legales</h1>
          <p style={styles.updated}>Conformement a la loi LCEN n°2004-575 du 21 juin 2004 — Article 6</p>
        </header>

        <div style={styles.divider} />

        {/* Section 1: Editeur */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Editeur du site</h2>
          <p style={styles.paragraph}>
            Le site NovaPress AI, accessible a l'adresse <strong>novapressai.com</strong>,
            est edite par :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}><strong>Raison sociale</strong> : NovaPress AI (projet personnel en cours d'immatriculation)</li>
            <li style={styles.listItem}><strong>Directeur de la publication</strong> : Thomas Kaddour</li>
            <li style={styles.listItem}><strong>Adresse email</strong> : <a href="mailto:contact@novapressai.com" style={styles.link}>contact@novapressai.com</a></li>
            <li style={styles.listItem}><strong>Telephone</strong> : Sur demande par email</li>
          </ul>
        </section>

        {/* Section 2: Hebergeur */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>2. Hebergement</h2>
          <p style={styles.paragraph}>
            Le site est heberge par :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}><strong>Auto-heberge</strong> sur infrastructure privee (mini-PC Firebat)</li>
            <li style={styles.listItem}><strong>Reverse proxy</strong> : Caddy avec certificats Let's Encrypt</li>
            <li style={styles.listItem}><strong>Localisation</strong> : France</li>
          </ul>
        </section>

        {/* Section 3: Propriete intellectuelle */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>3. Propriete intellectuelle</h2>
          <p style={styles.paragraph}>
            L'ensemble des elements du site NovaPress AI (textes generes, design, code,
            logo, graphiques) sont proteges par le droit de la propriete intellectuelle.
          </p>
          <p style={styles.paragraph}>
            Les syntheses publiees sur NovaPress AI sont <strong>generees par intelligence
            artificielle</strong> a partir de sources d'actualite publiques. Elles ne
            constituent pas une reproduction des articles originaux mais une analyse
            synthetique independante.
          </p>
          <p style={styles.paragraph}>
            Les titres et liens vers les articles sources renvoient vers les sites des
            editeurs de presse originaux, conformement au droit de citation et dans le
            but de generer du trafic vers ces editeurs.
          </p>
        </section>

        {/* Section 4: Contenu genere par IA */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>4. Contenu genere par intelligence artificielle</h2>
          <p style={styles.paragraph}>
            Conformement au Reglement europeen sur l'intelligence artificielle
            (AI Act, Reglement (UE) 2024/1689, Article 50), nous informons les
            utilisateurs que :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              Les syntheses d'actualite sont <strong>integralement generees par IA</strong>
              (modeles de langage via OpenRouter)
            </li>
            <li style={styles.listItem}>
              Le clustering thematique, la detection de contradictions et l'analyse
              causale sont realises par des algorithmes (HDBSCAN, BGE-M3, spaCy)
            </li>
            <li style={styles.listItem}>
              Les podcasts audio sont generes par synthese vocale (TTS)
            </li>
            <li style={styles.listItem}>
              Un <strong>Score de Transparence</strong> est calcule pour chaque synthese,
              evaluant la diversite des sources, la factualite et la couverture
            </li>
          </ul>
        </section>

        {/* Section 5: Droit des editeurs de presse */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>5. Droit des editeurs de presse et opt-out</h2>
          <p style={styles.paragraph}>
            NovaPress AI respecte les droits voisins des editeurs de presse
            (Directive (UE) 2019/790, transposee en droit francais par la loi
            n°2019-775 du 24 juillet 2019).
          </p>
          <p style={styles.paragraph}>
            Pour les sources de presse professionnelle, NovaPress AI ne stocke que
            les <strong>titres et les liens (URLs)</strong> vers les articles originaux.
            Aucun contenu editorial complet n'est reproduit ou stocke. Les syntheses
            IA sont des oeuvres independantes basees sur l'analyse de multiples sources.
          </p>
          <h3 style={styles.subsectionTitle}>Mecanisme d'opt-out</h3>
          <p style={styles.paragraph}>
            Si vous etes editeur de presse et souhaitez que vos contenus ne soient
            plus references par NovaPress AI, vous pouvez :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              Envoyer un email a{' '}
              <a href="mailto:optout@novapressai.com" style={styles.link}>optout@novapressai.com</a>
              {' '}avec le(s) domaine(s) concerne(s)
            </li>
            <li style={styles.listItem}>
              Utiliser la directive <code>User-agent: NovaPressBot</code> dans votre
              fichier <code>robots.txt</code>
            </li>
            <li style={styles.listItem}>
              Le retrait sera effectif sous 72 heures ouvrees
            </li>
          </ul>
        </section>

        {/* Section 6: Donnees personnelles */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>6. Protection des donnees personnelles</h2>
          <p style={styles.paragraph}>
            NovaPress AI s'engage a respecter le Reglement General sur la Protection
            des Donnees (RGPD, Reglement (UE) 2016/679).
          </p>
          <p style={styles.paragraph}>
            Pour plus d'informations sur le traitement de vos donnees personnelles,
            veuillez consulter notre{' '}
            <Link href="/privacy" style={styles.link}>Politique de confidentialite</Link>.
          </p>
        </section>

        {/* Section 7: Responsabilite */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>7. Limitation de responsabilite</h2>
          <p style={styles.paragraph}>
            Les syntheses generees par NovaPress AI sont produites automatiquement
            par intelligence artificielle et peuvent contenir des erreurs ou des
            approximations. Elles ne sauraient remplacer la lecture des articles
            originaux des editeurs de presse references.
          </p>
          <p style={styles.paragraph}>
            NovaPress AI ne peut etre tenu responsable des decisions prises sur
            la base de ces syntheses. Les utilisateurs sont invites a verifier
            les informations aupres des sources originales.
          </p>
        </section>

        {/* Section 8: Cookies */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>8. Cookies</h2>
          <p style={styles.paragraph}>
            NovaPress AI utilise des cookies strictement necessaires au fonctionnement
            du service (authentification, preferences utilisateur). Aucun cookie
            publicitaire ou de tracking tiers n'est utilise.
          </p>
        </section>

        {/* Section 9: Droit applicable */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>9. Droit applicable et juridiction</h2>
          <p style={styles.paragraph}>
            Les presentes mentions legales sont regies par le droit francais.
            Tout litige sera soumis a la competence exclusive des tribunaux francais.
          </p>
        </section>

        <div style={styles.divider} />

        {/* Footer */}
        <footer style={styles.footer}>
          <Link href="/terms" style={styles.footerLink}>Conditions d'utilisation</Link>
          <span style={styles.footerSeparator}>|</span>
          <Link href="/privacy" style={styles.footerLink}>Politique de confidentialite</Link>
          <span style={styles.footerSeparator}>|</span>
          <Link href="/" style={styles.footerLink}>Accueil</Link>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    padding: '40px 20px',
  },
  container: {
    maxWidth: '780px',
    margin: '0 auto',
  },
  backLink: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: '#6B7280',
    textDecoration: 'none',
    display: 'inline-block',
    marginBottom: '32px',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  logo: {
    fontSize: '28px',
    marginBottom: '16px',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '32px',
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
