'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { adminService, PipelineStatus, AdminStats, SourcesResponse } from '../../lib/api/services/admin';

interface SourceStatus {
  status: 'pending' | 'scraping' | 'success' | 'error' | 'timeout' | 'skipped' | 'empty';
  articles: number;
  error?: string;
  updated_at: string;
}

export default function AdminPipelinePage() {
  const { theme } = useTheme();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sources, setSources] = useState<SourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Pipeline configuration
  const [pipelineMode, setPipelineMode] = useState<'SCRAPE' | 'TOPIC' | 'SIMULATION'>('SCRAPE');
  const [maxArticles, setMaxArticles] = useState(20);

  // Real-time state
  const [sourceStats, setSourceStats] = useState<Record<string, SourceStatus>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection with proper cleanup
  useEffect(() => {
    isMountedRef.current = true;

    const connectWebSocket = () => {
      // Don't attempt connection if component is unmounted
      if (!isMountedRef.current) return;

      // Hardcode for reliability - env vars can be tricky in Next.js client
      const wsUrl = 'ws://localhost:5000/ws/pipeline';
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          handleWsMessage(data);
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Clear any existing reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Reconnect after 3 seconds only if still mounted
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      // Mark as unmounted to stop all callbacks
      isMountedRef.current = false;

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Handle WebSocket messages
  const handleWsMessage = (data: any) => {
    switch (data.type) {
      case 'state':
        setStatus({
          is_running: data.is_running,
          current_step: data.current_step,
          progress: data.progress,
          last_run: data.last_run,
          last_result: data.last_result
        });
        setSourceStats(data.source_stats || {});
        break;

      case 'progress':
        setStatus(prev => prev ? {
          ...prev,
          progress: data.progress,
          current_step: data.step,
          is_running: data.status === 'running'
        } : null);
        break;

      case 'source_update':
        setSourceStats(prev => ({
          ...prev,
          [data.source]: {
            status: data.status,
            articles: data.articles,
            error: data.error,
            updated_at: data.updated_at
          }
        }));
        break;

      case 'completed':
        setStatus(prev => prev ? {
          ...prev,
          is_running: false,
          current_step: 'completed',
          progress: 100,
          last_result: data
        } : null);
        break;

      case 'error':
        setStatus(prev => prev ? {
          ...prev,
          is_running: false,
          current_step: 'error'
        } : null);
        break;

      case 'status':
        if (data.status === 'cancelled' || data.status === 'stopping') {
          setStatus(prev => prev ? {
            ...prev,
            is_running: data.status === 'stopping',
            current_step: data.status
          } : null);
        }
        break;
    }
  };

  // Fetch stats and sources (requires auth)
  const fetchAdminData = useCallback(async () => {
    if (!adminKey) return;

    try {
      const [statsData, sourcesData] = await Promise.all([
        adminService.getStats(adminKey),
        adminService.getSources()
      ]);
      setStats(statsData);
      setSources(sourcesData);
      setIsAuthenticated(true);
      setError(null);
    } catch (err: any) {
      if (err.message?.includes('401')) {
        setError('Clef admin invalide');
        setIsAuthenticated(false);
      } else {
        setError('Erreur de connexion au backend');
      }
    }
  }, [adminKey]);

  // Run pipeline
  const handleRunPipeline = async () => {
    if (!adminKey) {
      setError('Veuillez entrer la clef admin');
      return;
    }

    setLoading(true);
    setError(null);
    setSourceStats({});

    try {
      await adminService.startPipeline({
        mode: pipelineMode,
        max_articles_per_source: maxArticles
      }, adminKey);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du lancement du pipeline');
    } finally {
      setLoading(false);
    }
  };

  // Stop pipeline
  const handleStopPipeline = async () => {
    if (!adminKey) return;

    setLoading(true);
    try {
      await adminService.stopPipeline(adminKey);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'arret du pipeline");
    } finally {
      setLoading(false);
    }
  };

  // Reset pipeline lock (for stuck pipelines)
  const handleResetLock = async () => {
    if (!adminKey) {
      setError('Veuillez entrer la clef admin');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await adminService.resetPipelineLock(adminKey);
      console.log('Reset lock result:', result);
      // Show success message
      setError(`Lock reinitialise: ${result.actions.join(', ')}`);
      // Refresh status
      const newStatus = await adminService.getStatus();
      setStatus(newStatus);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la reinitialisation du lock');
    } finally {
      setLoading(false);
    }
  };

  // Handle login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAdminData();
  };

  // Get source status color
  const getSourceStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10B981';
      case 'scraping': return '#2563EB';
      case 'error': return '#DC2626';
      case 'timeout': return '#F59E0B';
      case 'empty': return '#6B7280';
      default: return theme.border;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      padding: '32px'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${theme.text}`
        }}>
          <a href="/" style={{
            color: theme.textSecondary,
            textDecoration: 'none',
            fontSize: '14px'
          }}>
            ← Retour
          </a>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            fontWeight: '700',
            color: theme.text,
            margin: 0
          }}>
            Admin - Pipeline
          </h1>
          <span style={{
            backgroundColor: '#DC2626',
            color: 'white',
            padding: '4px 12px',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Admin Only
          </span>
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? '#10B981' : '#DC2626'
            }} />
            <span style={{
              fontSize: '12px',
              color: theme.textSecondary
            }}>
              {wsConnected ? 'WebSocket connecte' : 'WebSocket deconnecte'}
            </span>
          </div>
        </div>

        {/* Auth Form */}
        {!isAuthenticated && (
          <form onSubmit={handleLogin} style={{
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            padding: '32px',
            marginBottom: '32px',
            maxWidth: '400px'
          }}>
            <h2 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '24px',
              color: theme.text
            }}>
              Authentification Admin
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="admin-key-input"
                style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: theme.textSecondary,
                marginBottom: '8px'
              }}>
                Clef API Admin
              </label>
              <input
                type="password"
                id="admin-key-input"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="novapress-admin-2024"
                aria-label="Clef API Admin"
                aria-required="true"
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${theme.border}`,
                  fontSize: '14px',
                  backgroundColor: theme.bg,
                  color: theme.text
                }}
              />
            </div>
            {error && (
              <p style={{
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              aria-label="Se connecter à l'interface admin"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: theme.text,
                color: theme.card,
                border: 'none',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Se Connecter
            </button>
          </form>
        )}

        {/* Main Content (authenticated) */}
        {isAuthenticated && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '350px 1fr',
            gap: '24px'
          }}>
            {/* Left Column - Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Pipeline Control */}
              <div style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                padding: '24px'
              }}>
                <h2 style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '24px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${theme.border}`,
                  color: theme.text
                }}>
                  Controle Pipeline
                </h2>

                {/* Status */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: status?.is_running ? '#10B981' : '#6B7280',
                      animation: status?.is_running ? 'pulse 2s infinite' : 'none'
                    }} />
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: theme.text
                    }}>
                      {status?.is_running ? 'En cours' : status?.current_step === 'completed' ? 'Termine' : 'Inactif'}
                    </span>
                  </div>

                  {(status?.is_running || status?.progress) && (
                    <div>
                      <p style={{
                        fontSize: '13px',
                        color: theme.textSecondary,
                        marginBottom: '8px'
                      }}>
                        Etape: {status?.current_step || 'Initialisation'}
                      </p>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: theme.border,
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${status?.progress || 0}%`,
                          height: '100%',
                          backgroundColor: '#2563EB',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <p style={{
                        fontSize: '12px',
                        color: theme.textSecondary,
                        marginTop: '4px'
                      }}>
                        {status?.progress || 0}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Configuration */}
                <div style={{ marginBottom: '24px' }}>
                  <label
                    htmlFor="pipeline-mode-select"
                    style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: theme.textSecondary,
                    marginBottom: '8px'
                  }}>
                    Mode
                  </label>
                  <select
                    id="pipeline-mode-select"
                    value={pipelineMode}
                    onChange={(e) => setPipelineMode(e.target.value as 'SCRAPE' | 'TOPIC' | 'SIMULATION')}
                    disabled={status?.is_running}
                    aria-label="Mode du pipeline"
                    aria-disabled={status?.is_running}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${theme.border}`,
                      fontSize: '14px',
                      backgroundColor: theme.bg,
                      color: theme.text,
                      marginBottom: '16px'
                    }}
                  >
                    <option value="SCRAPE">SCRAPE - Scraping complet</option>
                    <option value="TOPIC">TOPIC - Recherche par sujet</option>
                    <option value="SIMULATION">SIMULATION - Test</option>
                  </select>

                  <label
                    htmlFor="max-articles-input"
                    style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: theme.textSecondary,
                    marginBottom: '8px'
                  }}>
                    Max articles par source
                  </label>
                  <input
                    type="number"
                    id="max-articles-input"
                    value={maxArticles}
                    onChange={(e) => setMaxArticles(parseInt(e.target.value) || 20)}
                    disabled={status?.is_running}
                    aria-label="Nombre maximum d'articles par source"
                    aria-disabled={status?.is_running}
                    min={1}
                    max={100}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: `1px solid ${theme.border}`,
                      fontSize: '14px',
                      backgroundColor: theme.bg,
                      color: theme.text
                    }}
                  />
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex',
                  gap: '12px'
                }}>
                  <button
                    onClick={handleRunPipeline}
                    disabled={status?.is_running || loading}
                    aria-label="Lancer le pipeline de scraping"
                    aria-busy={loading}
                    aria-disabled={status?.is_running || loading}
                    style={{
                      flex: 1,
                      padding: '12px',
                      backgroundColor: status?.is_running ? theme.border : '#10B981',
                      color: status?.is_running ? theme.textSecondary : 'white',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: status?.is_running ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Chargement...' : 'Lancer'}
                  </button>

                  <button
                    onClick={handleStopPipeline}
                    disabled={!status?.is_running || loading}
                    aria-label="Arrêter le pipeline en cours"
                    aria-disabled={!status?.is_running || loading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: status?.is_running ? '#DC2626' : theme.border,
                      color: status?.is_running ? 'white' : theme.textSecondary,
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: status?.is_running ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Stop
                  </button>
                </div>

                {/* Reset Lock Button - for stuck pipelines */}
                <button
                  onClick={handleResetLock}
                  disabled={loading || status?.is_running}
                  aria-label="Reinitialiser le lock du pipeline"
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#F59E0B',
                    color: 'white',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: loading || status?.is_running ? 'not-allowed' : 'pointer',
                    opacity: loading || status?.is_running ? 0.5 : 1
                  }}
                >
                  Reset Lock (si pipeline bloque)
                </button>

                {error && (
                  <p style={{
                    color: error.startsWith('Lock reinitialise') ? '#10B981' : '#DC2626',
                    fontSize: '13px',
                    marginTop: '16px'
                  }}>
                    {error}
                  </p>
                )}
              </div>

              {/* Statistics */}
              <div style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                padding: '24px'
              }}>
                <h2 style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '24px',
                  paddingBottom: '12px',
                  borderBottom: `1px solid ${theme.border}`,
                  color: theme.text
                }}>
                  Statistiques
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    backgroundColor: theme.bgSecondary,
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: '28px',
                      fontWeight: '700',
                      color: theme.text,
                      margin: 0
                    }}>
                      {stats?.articles?.total || 0}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: theme.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Articles
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: theme.bgSecondary,
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: '28px',
                      fontWeight: '700',
                      color: '#2563EB',
                      margin: 0
                    }}>
                      {stats?.syntheses?.total || 0}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      color: theme.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Syntheses AI
                    </p>
                  </div>
                </div>

                {/* Sources count */}
                <p style={{
                  fontSize: '13px',
                  color: theme.textSecondary
                }}>
                  {sources?.total_sources || 0} sources configurees
                </p>
              </div>
            </div>

            {/* Right Column - Sources Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Source Status Grid - Always visible */}
              <div style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                padding: '24px'
              }}>
                  <h2 style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    paddingBottom: '12px',
                    borderBottom: `1px solid ${theme.border}`,
                    color: theme.text
                  }}>
                    Status des Sources
                  </h2>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: '8px'
                  }}>
                    {Object.entries(sourceStats).map(([domain, stat]) => (
                      <div key={domain} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: theme.bgSecondary,
                        fontSize: '12px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: getSourceStatusColor(stat.status),
                          animation: stat.status === 'scraping' ? 'pulse 1s infinite' : 'none'
                        }} />
                        <span style={{
                          color: theme.text,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {domain}
                        </span>
                        {stat.articles > 0 && (
                          <span style={{
                            color: '#10B981',
                            fontWeight: '600'
                          }}>
                            {stat.articles}
                          </span>
                        )}
                        {stat.status === 'timeout' && (
                          <span style={{ color: '#F59E0B' }}>T/O</span>
                        )}
                        {stat.status === 'error' && (
                          <span style={{ color: '#DC2626' }}>ERR</span>
                        )}
                      </div>
                    ))}
                    {Object.keys(sourceStats).length === 0 && (
                      <p style={{
                        color: theme.textSecondary,
                        fontSize: '13px',
                        fontStyle: 'italic',
                        gridColumn: '1 / -1'
                      }}>
                        Lancez le pipeline pour voir le statut des sources en temps reel.
                      </p>
                    )}
                  </div>
                </div>
            </div>
          </div>
        )}

        {/* CSS Animations */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}
