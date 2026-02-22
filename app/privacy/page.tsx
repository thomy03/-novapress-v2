'use client';

import Link from 'next/link';

export default function PrivacyPage() {
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
          <h1 style={styles.title}>Politique de Confidentialite</h1>
          <p style={styles.updated}>Derniere mise a jour : Fevrier 2026</p>
        </header>

        <div style={styles.divider} />

        {/* Introduction */}
        <section style={styles.section}>
          <p style={styles.paragraph}>
            La presente politique de confidentialite decrit comment NovaPress AI
            (ci-apres "NovaPress", "nous" ou "notre") collecte, utilise et protege
            vos donnees personnelles conformement au Reglement General sur la
            Protection des Donnees (RGPD) et a la loi Informatique et Libertes.
          </p>
        </section>

        {/* Section 1 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>1. Responsable du traitement</h2>
          <p style={styles.paragraph}>
            Le responsable du traitement des donnees personnelles est :
          </p>
          <p style={styles.paragraph}>
            <strong>NovaPress AI</strong><br />
            Email :{' '}
            <a href="mailto:privacy@novapress.ai" style={styles.link}>privacy@novapress.ai</a>
          </p>
        </section>

        {/* Section 2 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>2. Donnees collectees</h2>

          <h3 style={styles.subsectionTitle}>2.1 Donnees de compte</h3>
          <ul style={styles.list}>
            <li style={styles.listItem}>Adresse email</li>
            <li style={styles.listItem}>Nom et prenom</li>
            <li style={styles.listItem}>Mot de passe (stocke sous forme de hash bcrypt, jamais en clair)</li>
          </ul>

          <h3 style={styles.subsectionTitle}>2.2 Donnees de navigation</h3>
          <ul style={styles.list}>
            <li style={styles.listItem}>Pages consultees et syntheses lues</li>
            <li style={styles.listItem}>Personas editoriales utilisees</li>
            <li style={styles.listItem}>Articles sauvegardes en favoris</li>
            <li style={styles.listItem}>Preferences de categories et d'alertes</li>
          </ul>

          <h3 style={styles.subsectionTitle}>2.3 Donnees techniques</h3>
          <ul style={styles.list}>
            <li style={styles.listItem}>Adresse IP</li>
            <li style={styles.listItem}>User-agent du navigateur</li>
            <li style={styles.listItem}>Cookies essentiels (session et preferences)</li>
          </ul>

          <h3 style={styles.subsectionTitle}>2.4 Donnees Telegram</h3>
          <p style={styles.paragraph}>
            Si vous utilisez notre agent Telegram, nous collectons :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>Identifiant de chat Telegram</li>
            <li style={styles.listItem}>Messages envoyes au bot (pour traitement et reponse)</li>
            <li style={styles.listItem}>Preferences et centres d'interet exprimes</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>3. Finalites du traitement</h2>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Finalite</div>
              <div style={styles.tableCell}>Description</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Fourniture du service</strong></div>
              <div style={styles.tableCell}>
                Generation de syntheses, alertes personnalisees, recommandations,
                personnalisation de l'experience utilisateur
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Amelioration du service</strong></div>
              <div style={styles.tableCell}>
                Analytics anonymises, amelioration des algorithmes de clustering
                et de synthese, detection des tendances d'usage
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Securite</strong></div>
              <div style={styles.tableCell}>
                Detection de fraude, rate limiting, prevention des abus,
                protection contre les acces non autorises
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Communication</strong></div>
              <div style={styles.tableCell}>
                Notifications de service, newsletters (avec consentement explicite),
                notifications push (avec consentement explicite)
              </div>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>4. Base legale du traitement (RGPD)</h2>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Base legale</div>
              <div style={styles.tableCell}>Traitements concernes</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Execution du contrat</strong></div>
              <div style={styles.tableCell}>
                Fourniture du service (syntheses, alertes, personnalisation),
                gestion du compte utilisateur, facturation
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Interet legitime</strong></div>
              <div style={styles.tableCell}>
                Securite du service, amelioration des algorithmes,
                analytics anonymises, prevention de la fraude
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Consentement</strong></div>
              <div style={styles.tableCell}>
                Communications marketing, newsletters, notifications push,
                cookies non essentiels (le cas echeant)
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Obligation legale</strong></div>
              <div style={styles.tableCell}>
                Conservation des donnees de facturation (10 ans),
                reponse aux requisitions judiciaires
              </div>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>5. Conservation des donnees</h2>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Type de donnees</div>
              <div style={styles.tableCell}>Duree de conservation</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Compte actif</strong></div>
              <div style={styles.tableCell}>
                Duree de l'utilisation du service + 1 an apres suppression du compte
              </div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Logs techniques</strong></div>
              <div style={styles.tableCell}>90 jours</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Donnees de facturation</strong></div>
              <div style={styles.tableCell}>10 ans (obligation legale comptable)</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Donnees Telegram</strong></div>
              <div style={styles.tableCell}>
                Memoire strategique : 90 jours d'inactivite puis suppression automatique
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>6. Partage des donnees</h2>

          <p style={styles.paragraph}>
            NovaPress ne vend jamais vos donnees personnelles a des tiers.
            Vos donnees peuvent etre partagees uniquement avec les prestataires
            suivants, dans le cadre strict de la fourniture du service :
          </p>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={styles.tableCell}>Prestataire</div>
              <div style={styles.tableCell}>Finalite</div>
              <div style={styles.tableCell}>Garanties</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>Stripe</strong></div>
              <div style={styles.tableCell}>Traitement des paiements</div>
              <div style={styles.tableCell}>Certifie PCI DSS</div>
            </div>
            <div style={styles.tableRow}>
              <div style={styles.tableCell}><strong>OVH / Hetzner</strong></div>
              <div style={styles.tableCell}>Hebergement des serveurs</div>
              <div style={styles.tableCell}>Serveurs en UE</div>
            </div>
          </div>

          <p style={styles.paragraph}>
            Aucun transfert de donnees hors de l'Union europeenne n'est effectue
            sans garanties appropriees (clauses contractuelles types de la
            Commission europeenne).
          </p>
        </section>

        {/* Section 7 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>7. Vos droits (RGPD)</h2>

          <p style={styles.paragraph}>
            Conformement au Reglement General sur la Protection des Donnees,
            vous disposez des droits suivants :
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>
              <strong>Droit d'acces</strong> : obtenir une copie de l'ensemble de vos
              donnees personnelles
            </li>
            <li style={styles.listItem}>
              <strong>Droit de rectification</strong> : corriger les donnees inexactes
              ou incompletes
            </li>
            <li style={styles.listItem}>
              <strong>Droit a l'effacement</strong> : demander la suppression de vos
              donnees personnelles
            </li>
            <li style={styles.listItem}>
              <strong>Droit a la portabilite</strong> : recevoir vos donnees dans un
              format structure et lisible par machine
            </li>
            <li style={styles.listItem}>
              <strong>Droit d'opposition</strong> : vous opposer au traitement de vos
              donnees pour des motifs legitimes
            </li>
            <li style={styles.listItem}>
              <strong>Droit a la limitation</strong> : demander la restriction du
              traitement de vos donnees
            </li>
            <li style={styles.listItem}>
              <strong>Retrait du consentement</strong> : retirer votre consentement a
              tout moment pour les traitements fondes sur celui-ci
            </li>
          </ul>

          <p style={styles.paragraph}>
            Pour exercer ces droits, contactez-nous a l'adresse :{' '}
            <a href="mailto:privacy@novapress.ai" style={styles.link}>privacy@novapress.ai</a>.
            Nous nous engageons a repondre dans un delai d'un mois.
          </p>

          <p style={styles.paragraph}>
            En cas de difficulte, vous pouvez introduire une reclamation aupres de la
            Commission Nationale de l'Informatique et des Libertes (CNIL) :{' '}
            <a href="https://www.cnil.fr" style={styles.link} target="_blank" rel="noopener noreferrer">
              www.cnil.fr
            </a>
          </p>
        </section>

        {/* Section 8 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>8. Cookies</h2>

          <h3 style={styles.subsectionTitle}>8.1 Cookies utilises</h3>
          <p style={styles.paragraph}>
            NovaPress utilise exclusivement des cookies essentiels au fonctionnement
            du service :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              <strong>Cookie de session</strong> : maintien de votre connexion
              (duree : session navigateur)
            </li>
            <li style={styles.listItem}>
              <strong>Cookie de preferences</strong> : sauvegarde de vos parametres
              d'affichage (duree : 1 an)
            </li>
          </ul>

          <h3 style={styles.subsectionTitle}>8.2 Ce que nous n'utilisons pas</h3>
          <ul style={styles.list}>
            <li style={styles.listItem}>Aucun cookie publicitaire</li>
            <li style={styles.listItem}>Aucun tracker tiers (Google Analytics, Facebook Pixel, etc.)</li>
            <li style={styles.listItem}>Aucun cookie de profilage marketing</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>9. Securite des donnees</h2>

          <p style={styles.paragraph}>
            Nous mettons en oeuvre les mesures techniques et organisationnelles
            suivantes pour proteger vos donnees :
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              <strong>Chiffrement en transit</strong> : toutes les communications sont
              protegees par HTTPS (TLS 1.2+)
            </li>
            <li style={styles.listItem}>
              <strong>Mots de passe</strong> : hashes avec l'algorithme bcrypt
              (jamais stockes en clair)
            </li>
            <li style={styles.listItem}>
              <strong>Acces restreint</strong> : seuls les membres autorises de l'equipe
              ont acces aux donnees personnelles, selon le principe du moindre privilege
            </li>
            <li style={styles.listItem}>
              <strong>Sauvegardes</strong> : sauvegardes regulieres et chiffrees
              des bases de donnees
            </li>
            <li style={styles.listItem}>
              <strong>Monitoring</strong> : surveillance continue des acces et
              detection d'anomalies
            </li>
          </ul>
        </section>

        {/* Section 10 */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>10. Modifications de cette politique</h2>

          <p style={styles.paragraph}>
            NovaPress se reserve le droit de modifier la presente politique de
            confidentialite. En cas de modification substantielle, les utilisateurs
            seront informes par email au moins 30 jours avant l'entree en vigueur
            des nouvelles dispositions.
          </p>
          <p style={styles.paragraph}>
            L'historique des modifications est conserve et accessible sur demande.
          </p>
        </section>

        <div style={styles.divider} />

        {/* Footer links */}
        <footer style={styles.footer}>
          <Link href="/terms" style={styles.footerLink}>
            Conditions Generales d'Utilisation
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
  table: {
    width: '100%',
    borderTop: '2px solid #000000',
    marginBottom: '24px',
  },
  tableHeader: {
    display: 'flex',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #000000',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'flex',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #E5E5E5',
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    lineHeight: 1.6,
    color: '#000000',
  },
  tableCell: {
    flex: 1,
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
