'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { subscriptionService, billingService } from '@/app/lib/api/services';
import { SubscriptionFeatures } from '@/app/types/api';

// ---------- Feature matrix ----------

interface FeatureRow {
  label: string;
  freeKey: string;    // feature key name returned by the API
  proKey: string;
  enterpriseKey: string;
}

const FEATURE_ROWS: FeatureRow[] = [
  {
    label: 'Syntheses illimitees',
    freeKey: '',
    proKey: 'unlimited_syntheses',
    enterpriseKey: 'unlimited_syntheses',
  },
  {
    label: 'Persona Switch',
    freeKey: '',
    proKey: 'persona_switch',
    enterpriseKey: 'persona_switch',
  },
  {
    label: 'Graphe Causal',
    freeKey: 'causal_graph',
    proKey: 'causal_graph',
    enterpriseKey: 'causal_graph',
  },
  {
    label: 'Timeline',
    freeKey: 'timeline',
    proKey: 'timeline',
    enterpriseKey: 'timeline',
  },
  {
    label: 'Briefing Audio',
    freeKey: '',
    proKey: 'audio_brief',
    enterpriseKey: 'audio_brief',
  },
  {
    label: 'Alertes Telegram',
    freeKey: '',
    proKey: 'telegram_alerts',
    enterpriseKey: 'telegram_alerts',
  },
  {
    label: 'Recherche semantique',
    freeKey: 'semantic_search',
    proKey: 'semantic_search',
    enterpriseKey: 'semantic_search',
  },
  {
    label: 'Bookmarks',
    freeKey: 'bookmarks',
    proKey: 'bookmarks',
    enterpriseKey: 'bookmarks',
  },
];

// ---------- Helpers ----------

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type Tier = 'free' | 'pro' | 'enterprise';

function TierBadge({ tier }: { tier: Tier }) {
  const configs: Record<Tier, { label: string; bg: string; color: string }> = {
    free: { label: 'GRATUIT', bg: '#F3F4F6', color: '#374151' },
    pro: { label: 'PRO', bg: '#2563EB', color: '#FFFFFF' },
    enterprise: { label: 'ENTERPRISE', bg: '#000000', color: '#FFFFFF' },
  };
  const cfg = configs[tier];
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      backgroundColor: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function CheckIcon({ available }: { available: boolean }) {
  if (available) {
    return (
      <span style={{
        color: '#2563EB',
        fontSize: '16px',
        fontWeight: '700',
        lineHeight: 1,
      }}>
        &#10003;
      </span>
    );
  }
  return (
    <span style={{
      color: '#DC2626',
      fontSize: '16px',
      fontWeight: '700',
      lineHeight: 1,
    }}>
      &#10007;
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#6B7280',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        margin: '0 0 8px 0',
      }}>
        {children}
      </p>
      <div style={{ height: '2px', backgroundColor: '#000000' }} />
    </div>
  );
}

// ---------- Main component ----------

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [features, setFeatures] = useState<SubscriptionFeatures | null>(null);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Fetch subscription features
  useEffect(() => {
    if (!isAuthenticated) return;
    setFeaturesLoading(true);
    subscriptionService
      .getFeatures()
      .then((data) => setFeatures(data))
      .catch(() => {
        // Fallback: minimal free-tier data
        setFeatures({
          tier: 'free',
          features: ['semantic_search', 'bookmarks', 'causal_graph', 'timeline'],
          limits: { syntheses_per_day: 5, syntheses_used_today: 0 },
        });
      })
      .finally(() => setFeaturesLoading(false));
  }, [isAuthenticated]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { url } = await billingService.createPortal();
      window.location.href = url;
    } catch {
      window.location.href = '/landing';
    } finally {
      setPortalLoading(false);
    }
  };

  // ---------- Loading spinner ----------
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '2px solid #E5E5E5',
          borderTop: '2px solid #000000',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Redirect is happening; render nothing
  if (!isAuthenticated) {
    return null;
  }

  const tier: Tier = (features?.tier ?? user?.subscription?.type ?? 'free') as Tier;
  const featureKeys: string[] = features?.features ?? [];
  const synthesesPerDay = features?.limits.syntheses_per_day ?? 5;
  const synthesesUsed = features?.limits.syntheses_used_today ?? 0;
  const expiresAt = user?.subscription?.expiresAt;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FFFFFF',
      fontFamily: 'Georgia, "Times New Roman", serif',
    }}>
      {/* Back link */}
      <div style={{ padding: '20px 24px 0' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: '#6B7280',
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Retour a l&apos;accueil
        </Link>
      </div>

      {/* Logo header */}
      <div style={{
        textAlign: 'center',
        padding: '32px 24px 0',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#000000',
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '-0.5px',
          }}>
            NOVA
          </span>
          <span style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#DC2626',
            fontFamily: 'Georgia, "Times New Roman", serif',
            letterSpacing: '-0.5px',
          }}>
            PRESS
          </span>
          <span style={{
            fontSize: '18px',
            fontWeight: '700',
            color: '#2563EB',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            marginLeft: '6px',
            verticalAlign: 'middle',
          }}>
            AI
          </span>
        </Link>
        <div style={{
          height: '1px',
          backgroundColor: '#000000',
          marginTop: '16px',
          maxWidth: '700px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }} />
      </div>

      {/* Main content */}
      <main style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}>
        {/* Page title */}
        <div style={{ marginBottom: '32px' }}>
          <SectionTitle>Mon Compte</SectionTitle>
        </div>

        {/* Subscription card */}
        <div style={{
          border: '1px solid #E5E5E5',
          padding: '24px',
          marginBottom: '40px',
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#6B7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}>
              Abonnement actuel
            </span>
            <TierBadge tier={tier} />
          </div>

          <div style={{ height: '1px', backgroundColor: '#E5E5E5', marginBottom: '20px' }} />

          {/* Free tier */}
          {tier === 'free' && (
            <>
              <p style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#000000',
                margin: '0 0 6px 0',
                letterSpacing: '-0.2px',
              }}>
                Plan Gratuit
              </p>
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                margin: '0 0 20px 0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}>
                5 syntheses/jour &middot; Persona neutre uniquement
              </p>

              {/* Usage counter */}
              <div style={{
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E5E5',
                padding: '12px 16px',
                marginBottom: '20px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    fontSize: '13px',
                    color: '#374151',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}>
                    {featuresLoading
                      ? 'Chargement...'
                      : `${synthesesUsed} synthese${synthesesUsed !== 1 ? 's' : ''} utilisee${synthesesUsed !== 1 ? 's' : ''} aujourd'hui sur ${synthesesPerDay}`
                    }
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: synthesesUsed >= synthesesPerDay ? '#DC2626' : '#000000',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}>
                    {synthesesUsed}/{synthesesPerDay}
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{
                  height: '3px',
                  backgroundColor: '#E5E5E5',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '100%',
                    width: synthesesPerDay > 0
                      ? `${Math.min(100, (synthesesUsed / synthesesPerDay) * 100)}%`
                      : '0%',
                    backgroundColor: synthesesUsed >= synthesesPerDay ? '#DC2626' : '#000000',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>

              {/* Upgrade button */}
              <Link
                href="/landing"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 0',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  boxSizing: 'border-box',
                }}
              >
                PASSER A PRO &mdash; 4,99 &euro;/mois
              </Link>
            </>
          )}

          {/* Pro tier */}
          {tier === 'pro' && (
            <>
              <p style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#000000',
                margin: '0 0 6px 0',
                letterSpacing: '-0.2px',
              }}>
                Plan Pro
              </p>
              {expiresAt && (
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: '0 0 20px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>
                  Expire le {formatDate(expiresAt)}
                </p>
              )}
              {!expiresAt && (
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: '0 0 20px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>
                  Syntheses illimitees &middot; Tous les personas
                </p>
              )}
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 0',
                  backgroundColor: portalLoading ? '#6B7280' : '#000000',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  boxSizing: 'border-box',
                }}
              >
                {portalLoading ? 'REDIRECTION...' : 'GERER MON ABONNEMENT'}
              </button>
            </>
          )}

          {/* Enterprise tier */}
          {tier === 'enterprise' && (
            <>
              <p style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#000000',
                margin: '0 0 6px 0',
                letterSpacing: '-0.2px',
              }}>
                Plan Enterprise
              </p>
              {expiresAt && (
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: '0 0 20px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>
                  Expire le {formatDate(expiresAt)}
                </p>
              )}
              {!expiresAt && (
                <p style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  margin: '0 0 20px 0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}>
                  Acces complet &middot; Support dedie
                </p>
              )}
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '13px 0',
                  backgroundColor: portalLoading ? '#6B7280' : '#000000',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.08em',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  boxSizing: 'border-box',
                }}
              >
                {portalLoading ? 'REDIRECTION...' : 'GERER MON ABONNEMENT'}
              </button>
            </>
          )}
        </div>

        {/* Features section */}
        <div style={{ marginBottom: '40px' }}>
          <SectionTitle>Vos fonctionnalites</SectionTitle>

          {featuresLoading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '24px 0',
              color: '#6B7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '14px',
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #E5E5E5',
                borderTop: '2px solid #000000',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Chargement des fonctionnalites...
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0',
            }}>
              {FEATURE_ROWS.map((row, index) => {
                // Determine the relevant key for this tier
                let key = '';
                if (tier === 'free') key = row.freeKey;
                else if (tier === 'pro') key = row.proKey;
                else key = row.enterpriseKey;

                const available = key !== '' && featureKeys.includes(key);
                const isRightColumn = index % 2 === 1;
                const isLastRow = index >= FEATURE_ROWS.length - 2;

                return (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderBottom: isLastRow ? 'none' : '1px solid #E5E5E5',
                      borderLeft: isRightColumn ? '1px solid #E5E5E5' : 'none',
                    }}
                  >
                    <CheckIcon available={available} />
                    <span style={{
                      fontSize: '14px',
                      color: available ? '#000000' : '#9CA3AF',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    }}>
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Information section */}
        <div style={{ marginBottom: '40px' }}>
          <SectionTitle>Informations</SectionTitle>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Name */}
            {user?.name && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#6B7280',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  marginBottom: '6px',
                }}>
                  Nom
                </label>
                <div style={{
                  padding: '10px 14px',
                  border: '1px solid #E5E5E5',
                  fontSize: '15px',
                  color: '#000000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  backgroundColor: '#F9FAFB',
                }}>
                  {user.name}
                </div>
              </div>
            )}

            {/* Email */}
            {user?.email && (
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#6B7280',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  marginBottom: '6px',
                }}>
                  Adresse email
                </label>
                <div style={{
                  padding: '10px 14px',
                  border: '1px solid #E5E5E5',
                  fontSize: '15px',
                  color: '#000000',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  backgroundColor: '#F9FAFB',
                }}>
                  {user.email}
                </div>
              </div>
            )}

            {/* Member since */}
            {user?.createdAt && (
              <p style={{
                fontSize: '13px',
                color: '#6B7280',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                margin: 0,
              }}>
                Membre depuis le {formatDate(user.createdAt)}
              </p>
            )}
          </div>
        </div>

        {/* Footer links */}
        <div style={{
          borderTop: '1px solid #E5E5E5',
          paddingTop: '24px',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
        }}>
          <Link
            href="/terms"
            style={{
              fontSize: '12px',
              color: '#6B7280',
              textDecoration: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Conditions d&apos;utilisation
          </Link>
          <Link
            href="/privacy"
            style={{
              fontSize: '12px',
              color: '#6B7280',
              textDecoration: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Politique de confidentialite
          </Link>
        </div>
      </main>
    </div>
  );
}
