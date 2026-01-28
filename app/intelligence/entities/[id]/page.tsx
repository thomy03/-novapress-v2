"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '../../../contexts/ThemeContext';
import { intelligenceService } from '../../../lib/api/services/intelligence';
import {
  EntityDetailResponse,
  EntityCausalProfile,
} from '../../../types/intelligence';
import { Header } from '../../../components/layout/Header';

// Entity type configuration
const ENTITY_TYPE_CONFIG: Record<string, { color: string; emoji: string; label: string }> = {
  'PERSON': { color: '#8B5CF6', emoji: '👤', label: 'Personne' },
  'ORG': { color: '#3B82F6', emoji: '🏢', label: 'Organisation' },
  'GPE': { color: '#10B981', emoji: '🌍', label: 'Pays/Ville' },
  'LOC': { color: '#F59E0B', emoji: '📍', label: 'Lieu' },
  'EVENT': { color: '#EF4444', emoji: '📅', label: 'Evenement' },
  'PRODUCT': { color: '#EC4899', emoji: '📦', label: 'Produit' },
  'UNKNOWN': { color: '#6B7280', emoji: '❓', label: 'Inconnu' }
};

export default function EntityDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<EntityDetailResponse | null>(null);
  const [causalProfile, setCausalProfile] = useState<EntityCausalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!entityId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch entity details and causal profile in parallel
      const [entityData, profileData] = await Promise.all([
        intelligenceService.getEntityById(entityId),
        intelligenceService.getEntityCausalProfile(entityId).catch(() => null)
      ]);

      setEntity(entityData);
      setCausalProfile(profileData);
    } catch (err) {
      console.error('Failed to fetch entity:', err);
      setError('Impossible de charger les details de l\'entite.');
    } finally {
      setIsLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E5E5E5',
            borderTopColor: '#8B5CF6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: theme.textSecondary }}>Chargement de l'entite...</p>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>😕</p>
          <h1 style={{ fontSize: '24px', color: theme.text, marginBottom: '8px' }}>
            Entite introuvable
          </h1>
          <p style={{ color: theme.textSecondary, marginBottom: '24px' }}>
            {error || 'Cette entite n\'existe pas ou a ete supprimee.'}
          </p>
          <Link href="/intelligence" style={{
            color: '#8B5CF6',
            textDecoration: 'none',
            fontWeight: '600'
          }}>
            ← Retour a l'Intelligence Hub
          </Link>
        </div>
      </div>
    );
  }

  const typeConfig = ENTITY_TYPE_CONFIG[entity.entity_type] || ENTITY_TYPE_CONFIG['UNKNOWN'];
  const causeRatio = causalProfile?.cause_ratio ?? 0.5;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/intelligence" style={{
            color: theme.textSecondary,
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            ← Retour a l'Intelligence Hub
          </Link>
        </div>

        {/* Entity Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Entity Avatar */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: `${typeConfig.color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            flexShrink: 0
          }}>
            {typeConfig.emoji}
          </div>

          <div style={{ flex: 1 }}>
            {/* Type Badge */}
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              color: typeConfig.color,
              backgroundColor: `${typeConfig.color}15`,
              padding: '4px 10px',
              borderRadius: '10px',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '8px'
            }}>
              {typeConfig.label}
            </span>

            {/* Entity Name */}
            <h1 style={{
              fontSize: '28px',
              fontWeight: '900',
              fontFamily: 'Georgia, serif',
              color: theme.text,
              margin: '0 0 8px 0'
            }}>
              {entity.canonical_name}
            </h1>

            {/* Aliases */}
            {entity.aliases.length > 0 && (
              <div style={{
                fontSize: '13px',
                color: theme.textSecondary
              }}>
                Aussi connu(e) sous: {entity.aliases.join(', ')}
              </div>
            )}

            {/* Description */}
            {entity.description && (
              <p style={{
                fontSize: '15px',
                color: theme.textSecondary,
                margin: '12px 0 0 0',
                lineHeight: '1.5'
              }}>
                {entity.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '16px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>
              {entity.mention_count}
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary }}>Mentions</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>
              {entity.synthesis_count}
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary }}>Syntheses</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#EF444420',
            borderRadius: '12px',
            border: `1px solid #EF444440`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#EF4444' }}>
              {entity.as_cause_count}
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary }}>Cause de</div>
          </div>
          <div style={{
            padding: '16px',
            backgroundColor: '#3B82F620',
            borderRadius: '12px',
            border: `1px solid #3B82F640`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#3B82F6' }}>
              {entity.as_effect_count}
            </div>
            <div style={{ fontSize: '12px', color: theme.textSecondary }}>Effet de</div>
          </div>
        </div>

        {/* Cause/Effect Ratio Bar */}
        {(entity.as_cause_count > 0 || entity.as_effect_count > 0) && (
          <div style={{
            marginBottom: '32px',
            padding: '16px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.text,
              marginBottom: '12px'
            }}>
              Ratio Cause/Effet
            </h3>
            <div style={{
              height: '24px',
              backgroundColor: '#3B82F640',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${causeRatio * 100}%`,
                backgroundColor: '#EF4444',
                borderRadius: '12px 0 0 12px',
                transition: 'width 0.3s ease'
              }} />
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '11px',
                fontWeight: '700',
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
              }}>
                {(causeRatio * 100).toFixed(0)}% Cause | {((1 - causeRatio) * 100).toFixed(0)}% Effet
              </div>
            </div>
            <p style={{
              fontSize: '12px',
              color: theme.textSecondary,
              marginTop: '8px',
              textAlign: 'center'
            }}>
              {causeRatio > 0.6
                ? 'Cette entite est principalement une cause dans les relations'
                : causeRatio < 0.4
                  ? 'Cette entite est principalement un effet dans les relations'
                  : 'Cette entite est equilibree entre cause et effet'}
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Causal Profile - As Cause */}
          {causalProfile && causalProfile.as_cause.length > 0 && (
            <div style={{
              padding: '20px',
              backgroundColor: '#EF444410',
              borderRadius: '12px',
              border: `1px solid #EF444430`
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#EF4444',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ⚡ Provoque
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {causalProfile.as_cause.slice(0, 5).map((rel, i) => (
                  <Link
                    key={i}
                    href={`/synthesis/${rel.synthesis_id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: theme.bg,
                      borderRadius: '8px',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}>
                      <div style={{
                        fontSize: '13px',
                        color: theme.text,
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        → {rel.effect}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: theme.textSecondary
                      }}>
                        {rel.synthesis_title.substring(0, 50)}...
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Causal Profile - As Effect */}
          {causalProfile && causalProfile.as_effect.length > 0 && (
            <div style={{
              padding: '20px',
              backgroundColor: '#3B82F610',
              borderRadius: '12px',
              border: `1px solid #3B82F630`
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#3B82F6',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                🎯 Resulte de
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {causalProfile.as_effect.slice(0, 5).map((rel, i) => (
                  <Link
                    key={i}
                    href={`/synthesis/${rel.synthesis_id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      padding: '10px 12px',
                      backgroundColor: theme.bg,
                      borderRadius: '8px',
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}>
                      <div style={{
                        fontSize: '13px',
                        color: theme.text,
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        ← {rel.cause}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: theme.textSecondary
                      }}>
                        {rel.synthesis_title.substring(0, 50)}...
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Related Entities */}
        {entity.related_entities.length > 0 && (
          <div style={{
            marginTop: '32px',
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.text,
              marginBottom: '12px'
            }}>
              Entites Liees
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {entity.related_entities.slice(0, 15).map((relatedId, i) => (
                <Link
                  key={i}
                  href={`/intelligence/entities/${relatedId}`}
                  style={{
                    fontSize: '12px',
                    color: typeConfig.color,
                    backgroundColor: `${typeConfig.color}15`,
                    padding: '6px 12px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = `${typeConfig.color}30`;
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = `${typeConfig.color}15`;
                  }}
                >
                  {relatedId.substring(0, 8)}...
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Topics */}
        {entity.topics.length > 0 && (
          <div style={{
            marginTop: '24px',
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.text,
              marginBottom: '12px'
            }}>
              Present(e) dans les Topics
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {entity.topics.map((topicId, i) => (
                <Link
                  key={i}
                  href={`/intelligence/topics/${topicId}`}
                  style={{
                    fontSize: '12px',
                    color: '#2563EB',
                    backgroundColor: '#2563EB15',
                    padding: '6px 12px',
                    borderRadius: '14px',
                    textDecoration: 'none',
                    fontWeight: '600'
                  }}
                >
                  Topic {topicId.substring(0, 8)}...
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Info */}
        {(entity.first_seen || entity.last_seen) && (
          <div style={{
            marginTop: '24px',
            display: 'flex',
            gap: '24px',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            {entity.first_seen && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  Premiere apparition
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>
                  {new Date(entity.first_seen).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            )}
            {entity.last_seen && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                  Derniere apparition
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>
                  {new Date(entity.last_seen).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
