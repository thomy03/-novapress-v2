'use client';

import React, { useState, useEffect } from 'react';

// Types
interface Feature {
  id: string;
  title: string;
  description: string;
  files: string[];
  status: 'pending' | 'in_progress' | 'completed';
  blocking: boolean;
  tests: string[];
}

interface Phase {
  id: string;
  name: string;
  priority: string;
  estimated_days: number;
  features: Feature[];
}

interface FeaturesData {
  metadata: {
    project: string;
    version: string;
    last_updated: string;
    total_features: number;
    completed: number;
    in_progress: number;
    pending: number;
  };
  phases: Phase[];
}

// Couleurs par priorité
const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
  'P0': { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
  'P0-P1': { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
  'P1': { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
  'P1-P2': { bg: '#DBEAFE', border: '#2563EB', text: '#1E40AF' },
  'P2': { bg: '#DBEAFE', border: '#2563EB', text: '#1E40AF' },
  'P2-P3': { bg: '#E5E7EB', border: '#6B7280', text: '#374151' },
  'P3': { bg: '#E5E7EB', border: '#6B7280', text: '#374151' },
};

// Composant Card simple
function FeatureCard({ feature, phase, onStatusChange }: {
  feature: Feature;
  phase: Phase;
  onStatusChange: (id: string, phaseId: string, status: Feature['status']) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = priorityColors[phase.priority] || priorityColors['P2'];

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        backgroundColor: '#FFFFFF',
        border: `1px solid ${colors.border}`,
        borderLeft: `4px solid ${colors.border}`,
        borderRadius: '4px',
        padding: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontSize: '10px',
          fontWeight: '700',
          fontFamily: 'monospace',
          color: colors.text,
          backgroundColor: colors.bg,
          padding: '2px 6px',
          borderRadius: '2px',
        }}>
          {feature.id}
        </span>
        {feature.blocking && (
          <span style={{
            fontSize: '9px',
            fontWeight: '700',
            color: '#DC2626',
            backgroundColor: '#FEE2E2',
            padding: '2px 4px',
            borderRadius: '2px',
          }}>
            BLOCKING
          </span>
        )}
      </div>

      <h4 style={{
        fontSize: '13px',
        fontWeight: '600',
        color: '#000000',
        margin: '0 0 4px 0',
      }}>
        {feature.title}
      </h4>

      <div style={{ fontSize: '10px', color: '#6B7280' }}>
        {phase.name.split(':')[0]}
      </div>

      {expanded && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #E5E5E5', paddingTop: '12px' }}>
          <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 12px 0' }}>
            {feature.description}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {feature.status !== 'in_progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(feature.id, phase.id, 'in_progress'); }}
                style={{
                  fontSize: '10px',
                  padding: '4px 8px',
                  border: '1px solid #D97706',
                  borderRadius: '2px',
                  backgroundColor: '#FEF3C7',
                  cursor: 'pointer',
                }}
              >
                Commencer
              </button>
            )}
            {feature.status !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(feature.id, phase.id, 'completed'); }}
                style={{
                  fontSize: '10px',
                  padding: '4px 8px',
                  border: '1px solid #059669',
                  borderRadius: '2px',
                  backgroundColor: '#D1FAE5',
                  cursor: 'pointer',
                }}
              >
                Terminer
              </button>
            )}
            {feature.status !== 'pending' && (
              <button
                onClick={(e) => { e.stopPropagation(); onStatusChange(feature.id, phase.id, 'pending'); }}
                style={{
                  fontSize: '10px',
                  padding: '4px 8px',
                  border: '1px solid #6B7280',
                  borderRadius: '2px',
                  backgroundColor: '#F3F4F6',
                  cursor: 'pointer',
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Composant Column
function KanbanColumn({ title, status, items, onStatusChange }: {
  title: string;
  status: Feature['status'];
  items: Array<{ feature: Feature; phase: Phase }>;
  onStatusChange: (id: string, phaseId: string, status: Feature['status']) => void;
}) {
  const colors = {
    pending: { bg: '#F9FAFB', header: '#6B7280' },
    in_progress: { bg: '#FEF3C7', header: '#D97706' },
    completed: { bg: '#D1FAE5', header: '#059669' },
  }[status];

  return (
    <div style={{
      flex: 1,
      minWidth: '300px',
      maxWidth: '400px',
      backgroundColor: colors.bg,
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `2px solid ${colors.header}`,
      }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '700',
          color: colors.header,
          margin: 0,
          textTransform: 'uppercase',
        }}>
          {title}
        </h3>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#FFFFFF',
          backgroundColor: colors.header,
          padding: '2px 8px',
          borderRadius: '10px',
        }}>
          {items.length}
        </span>
      </div>

      <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        {items.map(({ feature, phase }) => (
          <FeatureCard
            key={feature.id}
            feature={feature}
            phase={phase}
            onStatusChange={onStatusChange}
          />
        ))}
        {items.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            Aucune tache
          </div>
        )}
      </div>
    </div>
  );
}

// Page principale
export default function KanbanPage() {
  const [data, setData] = useState<FeaturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentTask, setCurrentTask] = useState<{ feature: Feature; phase: Phase } | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Charger les données avec polling toutes les 10 secondes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cache-busting pour forcer le rechargement
        const res = await fetch(`/api/dev/features?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        // Comparer avec les données précédentes pour détecter les changements
        if (data && JSON.stringify(data.metadata) !== JSON.stringify(json.metadata)) {
          console.log('📊 Kanban: Données mises à jour!', json.metadata);
        }

        setData(json);
        setLastRefresh(new Date());
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Kanban: Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Polling toutes les 10 secondes pour réactivité
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, []);

  // Changer le status
  const handleStatusChange = (featureId: string, phaseId: string, newStatus: Feature['status']) => {
    if (!data) return;

    const newData = JSON.parse(JSON.stringify(data)) as FeaturesData;
    for (const phase of newData.phases) {
      if (phase.id === phaseId) {
        const feature = phase.features.find(f => f.id === featureId);
        if (feature) {
          feature.status = newStatus;
        }
      }
    }

    // Recalculer metadata
    let pending = 0, in_progress = 0, completed = 0;
    for (const phase of newData.phases) {
      for (const feature of phase.features) {
        if (feature.status === 'pending') pending++;
        else if (feature.status === 'in_progress') in_progress++;
        else completed++;
      }
    }
    newData.metadata.pending = pending;
    newData.metadata.in_progress = in_progress;
    newData.metadata.completed = completed;

    setData(newData);

    // Sauvegarder
    fetch('/api/dev/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData),
    }).catch(console.error);
  };

  // Filtrer par status
  const getByStatus = (status: Feature['status']) => {
    if (!data) return [];
    const result: Array<{ feature: Feature; phase: Phase }> = [];
    for (const phase of data.phases) {
      if (filterPhase !== 'all' && phase.id !== filterPhase) continue;
      for (const feature of phase.features) {
        if (feature.status === status) {
          result.push({ feature, phase });
        }
      }
    }
    return result;
  };

  // Trouver la prochaine tâche prioritaire (blocking d'abord, puis par phase)
  const getNextTask = (): { feature: Feature; phase: Phase } | null => {
    if (!data) return null;

    // D'abord chercher les tâches blocking
    for (const phase of data.phases) {
      for (const feature of phase.features) {
        if (feature.status === 'pending' && feature.blocking) {
          return { feature, phase };
        }
      }
    }

    // Sinon la première pending
    for (const phase of data.phases) {
      for (const feature of phase.features) {
        if (feature.status === 'pending') {
          return { feature, phase };
        }
      }
    }

    return null;
  };

  // Trouver la tâche en cours
  const getCurrentTask = (): { feature: Feature; phase: Phase } | null => {
    if (!data) return null;
    for (const phase of data.phases) {
      for (const feature of phase.features) {
        if (feature.status === 'in_progress') {
          return { feature, phase };
        }
      }
    }
    return null;
  };

  // Démarrer le développement
  const handleStartDev = () => {
    const inProgress = getCurrentTask();
    if (inProgress) {
      setCurrentTask(inProgress);
      setShowPrompt(true);
      return;
    }

    const next = getNextTask();
    if (next) {
      handleStatusChange(next.feature.id, next.phase.id, 'in_progress');
      setCurrentTask(next);
      setShowPrompt(true);
    }
  };

  // Copier le prompt Claude
  const copyPrompt = () => {
    if (!currentTask) return;
    const prompt = `Projet NovaPress v2. Travaille sur la tâche ${currentTask.feature.id}: "${currentTask.feature.title}"

Description: ${currentTask.feature.description}

Fichiers concernés:
${currentTask.feature.files.map(f => `- ${f}`).join('\n')}

Tests de validation:
${currentTask.feature.tests.map(t => `- ${t}`).join('\n')}

Lis .claude/claude-progress.md pour le contexte complet.`;

    navigator.clipboard.writeText(prompt).then(() => {
      alert('Prompt copié ! Collez-le dans Claude Code.');
    });
  };

  // Lancer Claude Code - Mode Continue (reprend le projet)
  const launchContinue = async () => {
    setIsLaunching(true);
    setLaunchStatus('Lancement de Claude Code...');

    try {
      const response = await fetch('/api/dev/launch-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'continue' })
      });

      const result = await response.json();

      if (response.ok) {
        setLaunchStatus(`✅ ${result.message}`);
        setTimeout(() => setLaunchStatus(null), 3000);
      } else {
        setLaunchStatus(`❌ Erreur: ${result.error}`);
      }
    } catch (err) {
      setLaunchStatus(`❌ Erreur: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // Lancer Claude Code - Tâche spécifique
  const launchClaudeCode = async () => {
    if (!currentTask) return;

    setIsLaunching(true);
    setLaunchStatus('Lancement de Claude Code...');

    try {
      const response = await fetch('/api/dev/launch-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureId: currentTask.feature.id,
          phaseId: currentTask.phase.id
        })
      });

      const result = await response.json();

      if (response.ok) {
        setLaunchStatus(`✅ ${result.message}`);
        setShowPrompt(false);
        setTimeout(() => {
          setLaunchStatus(null);
          window.location.reload();
        }, 2000);
      } else {
        setLaunchStatus(`❌ Erreur: ${result.error}`);
      }
    } catch (err) {
      setLaunchStatus(`❌ Erreur: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // Terminer la tâche en cours
  const handleFinishTask = () => {
    if (currentTask) {
      handleStatusChange(currentTask.feature.id, currentTask.phase.id, 'completed');
      setCurrentTask(null);
      setShowPrompt(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: '#374151' }}>Chargement du Kanban...</div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEE2E2',
      }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ color: '#DC2626', marginBottom: '16px' }}>Erreur</h1>
          <p style={{ color: '#991B1B' }}>{error}</p>
        </div>
      </div>
    );
  }

  const progress = data ? Math.round((data.metadata.completed / data.metadata.total_features) * 100) : 0;
  const activeTask = getCurrentTask();
  const nextTask = getNextTask();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F3F4F6' }}>
      {/* Modal Prompt */}
      {showPrompt && currentTask && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>🚀 Tâche en cours</h2>
              <button
                onClick={() => setShowPrompt(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6B7280',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              backgroundColor: '#FEF3C7',
              border: '2px solid #D97706',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
            }}>
              <div style={{ fontSize: '12px', color: '#92400E', fontWeight: '600', marginBottom: '8px' }}>
                {currentTask.feature.id} • {currentTask.phase.name}
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#000' }}>
                {currentTask.feature.title}
              </h3>
              <p style={{ margin: 0, color: '#374151', fontSize: '14px' }}>
                {currentTask.feature.description}
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>📁 Fichiers à modifier:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {currentTask.feature.files.map((file, i) => (
                  <code key={i} style={{
                    backgroundColor: '#F3F4F6',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}>
                    {file}
                  </code>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>✅ Tests de validation:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#374151', fontSize: '14px' }}>
                {currentTask.feature.tests.map((test, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{test}</li>
                ))}
              </ul>
            </div>

            {/* Status de lancement */}
            {launchStatus && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                backgroundColor: launchStatus.startsWith('✅') ? '#D1FAE5' : launchStatus.startsWith('❌') ? '#FEE2E2' : '#DBEAFE',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
              }}>
                {launchStatus}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {/* Bouton principal - Lancer Claude Code */}
              <button
                onClick={launchClaudeCode}
                disabled={isLaunching}
                style={{
                  flex: 2,
                  padding: '14px 24px',
                  backgroundColor: isLaunching ? '#9CA3AF' : '#7C3AED',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: isLaunching ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLaunching ? (
                  <>⏳ Lancement...</>
                ) : (
                  <>🚀 Lancer Claude Code</>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button
                onClick={copyPrompt}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                📋 Copier prompt
              </button>
              <button
                onClick={handleFinishTask}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#D1FAE5',
                  color: '#065F46',
                  border: '1px solid #6EE7B7',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                ✓ Terminer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{
        backgroundColor: '#000000',
        color: '#FFFFFF',
        padding: '20px 40px',
        borderBottom: '4px solid #DC2626',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
              NovaPress <span style={{ color: '#2563EB' }}>AI</span> — Kanban
            </h1>
            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '4px 0 0 0' }}>
              {data?.metadata.version} • Mis a jour: {data?.metadata.last_updated}
              <span style={{
                marginLeft: '12px',
                color: '#10B981',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10B981',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite',
                }}></span>
                LIVE (10s) • {lastRefresh.toLocaleTimeString()}
              </span>
              <style>{`
                @keyframes pulse {
                  0%, 100% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.5; transform: scale(1.2); }
                }
              `}</style>
            </p>
          </div>

          {/* Boutons d'action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Bouton principal - Continuer le projet */}
            <button
              onClick={launchContinue}
              disabled={isLaunching}
              style={{
                padding: '14px 32px',
                backgroundColor: isLaunching ? '#9CA3AF' : '#7C3AED',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isLaunching ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
              }}
            >
              {isLaunching ? '⏳ Lancement...' : '▶ Continuer le projet'}
            </button>

            {/* Bouton secondaire - Tâche suivante */}
            <button
              onClick={handleStartDev}
              disabled={!nextTask && !activeTask}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: activeTask ? '#D97706' : '#059669',
                border: `2px solid ${activeTask ? '#D97706' : '#059669'}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: nextTask || activeTask ? 'pointer' : 'not-allowed',
                opacity: nextTask || activeTask ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {activeTask ? (
                <>{activeTask.feature.id} (en cours)</>
              ) : nextTask ? (
                <>Voir {nextTask.feature.id}</>
              ) : (
                <>✅ Terminé</>
              )}
            </button>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                <span style={{ fontWeight: '700', fontSize: '24px' }}>{progress}%</span>
                <span style={{ color: '#9CA3AF', marginLeft: '8px' }}>
                  ({data?.metadata.completed}/{data?.metadata.total_features})
                </span>
              </div>
              <div style={{
                width: '200px',
                height: '8px',
                backgroundColor: '#374151',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: '#059669',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Status de lancement global */}
        {launchStatus && (
          <div style={{
            marginTop: '12px',
            padding: '10px 16px',
            backgroundColor: launchStatus.startsWith('✅') ? 'rgba(16, 185, 129, 0.2)' : launchStatus.startsWith('❌') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#FFFFFF',
          }}>
            {launchStatus}
          </div>
        )}

        {/* Filtres */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterPhase('all')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: filterPhase === 'all' ? '#FFFFFF' : '#374151',
              color: filterPhase === 'all' ? '#000000' : '#FFFFFF',
            }}
          >
            Tout ({data?.metadata.total_features})
          </button>
          {data?.phases.map(phase => (
            <button
              key={phase.id}
              onClick={() => setFilterPhase(phase.id)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: filterPhase === phase.id ? '#FFFFFF' : '#374151',
                color: filterPhase === phase.id ? '#000000' : '#FFFFFF',
              }}
            >
              {phase.name.split(':')[0]} ({phase.features.length})
            </button>
          ))}
        </div>
      </header>

      {/* Stats */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '16px 40px',
        display: 'flex',
        gap: '40px',
        borderBottom: '1px solid #E5E5E5',
      }}>
        <div>
          <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', fontWeight: '600' }}>
            En attente
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#6B7280' }}>
            {data?.metadata.pending}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#D97706', textTransform: 'uppercase', fontWeight: '600' }}>
            En cours
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#D97706' }}>
            {data?.metadata.in_progress}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#059669', textTransform: 'uppercase', fontWeight: '600' }}>
            Terminees
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#059669' }}>
            {data?.metadata.completed}
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <main style={{
        padding: '24px 40px',
        display: 'flex',
        gap: '24px',
        overflowX: 'auto',
      }}>
        <KanbanColumn
          title="A faire"
          status="pending"
          items={getByStatus('pending')}
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn
          title="En cours"
          status="in_progress"
          items={getByStatus('in_progress')}
          onStatusChange={handleStatusChange}
        />
        <KanbanColumn
          title="Termine"
          status="completed"
          items={getByStatus('completed')}
          onStatusChange={handleStatusChange}
        />
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 40px',
        borderTop: '1px solid #E5E5E5',
        backgroundColor: '#FFFFFF',
        fontSize: '12px',
        color: '#6B7280',
      }}>
        <a href="/" style={{ color: '#2563EB', marginRight: '16px' }}>← Accueil</a>
        <a href="/admin/pipeline" style={{ color: '#2563EB' }}>Admin →</a>
      </footer>
    </div>
  );
}
