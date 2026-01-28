'use client';

import { useState, useEffect } from 'react';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'checking' | 'online' | 'offline' | 'error';
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export default function StatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Frontend (Next.js)', url: '', status: 'online' },
    { name: 'Backend API', url: 'http://localhost:5000/health', status: 'checking' },
    { name: 'Backend Docs', url: 'http://localhost:5000/api/docs', status: 'checking' },
    { name: 'Qdrant', url: 'http://localhost:6333/collections', status: 'checking' },
    { name: 'Redis', url: 'http://localhost:5000/api/admin/status', status: 'checking' },
  ]);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const checkService = async (service: ServiceStatus): Promise<ServiceStatus> => {
    if (!service.url) {
      return { ...service, status: 'online' };
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(service.url, {
        signal: controller.signal,
        mode: 'no-cors'
      });
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      addLog(`${service.name}: OK (${responseTime}ms)`);

      return {
        ...service,
        status: 'online',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLog(`${service.name}: FAILED - ${errorMsg}`);

      return {
        ...service,
        status: 'offline',
        responseTime,
        error: errorMsg,
      };
    }
  };

  const checkAllServices = async () => {
    addLog('Starting health check...');
    const results = await Promise.all(services.map(checkService));
    setServices(results);
    setLastCheck(new Date());
    addLog('Health check complete');
  };

  useEffect(() => {
    checkAllServices();
    const interval = setInterval(checkAllServices, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#22c55e';
      case 'offline': return '#ef4444';
      case 'error': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '✓';
      case 'offline': return '✗';
      case 'error': return '⚠';
      default: return '○';
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#fff'
          }}>
            NovaPress AI - System Status
          </h1>
          <p style={{ color: '#94a3b8' }}>
            Last check: {lastCheck ? lastCheck.toLocaleString() : 'Checking...'}
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Services Status */}
          <section style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              Services
              <button
                onClick={checkAllServices}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {services.map((service, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    borderLeft: `4px solid ${getStatusColor(service.status)}`
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500' }}>{service.name}</div>
                    {service.url && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {service.url}
                      </div>
                    )}
                    {service.error && (
                      <div style={{ fontSize: '12px', color: '#ef4444' }}>
                        {service.error}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {service.responseTime !== undefined && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {service.responseTime}ms
                      </span>
                    )}
                    <span style={{
                      color: getStatusColor(service.status),
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}>
                      {getStatusIcon(service.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Logs */}
          <section style={{
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              Logs
              <button
                onClick={() => setLogs([])}
                style={{
                  backgroundColor: '#475569',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </h2>

            <div style={{
              backgroundColor: '#0f172a',
              borderRadius: '6px',
              padding: '12px',
              height: '400px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {logs.length === 0 ? (
                <div style={{ color: '#64748b' }}>No logs yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '4px 0',
                      borderBottom: '1px solid #1e293b',
                      color: log.includes('FAILED') ? '#ef4444' :
                             log.includes('OK') ? '#22c55e' : '#94a3b8'
                    }}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Quick Links */}
        <section style={{
          marginTop: '24px',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Quick Links
          </h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { name: 'Home', url: 'http://localhost:3005' },
              { name: 'Kanban', url: 'http://localhost:3005/dev/kanban' },
              { name: 'API Docs', url: 'http://localhost:5000/api/docs' },
              { name: 'Admin Pipeline', url: 'http://localhost:3005/admin/pipeline' },
              { name: 'Live News', url: 'http://localhost:3005/live' },
            ].map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '14px'
                }}
              >
                {link.name}
              </a>
            ))}
          </div>
        </section>

        {/* Environment Info */}
        <section style={{
          marginTop: '24px',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Environment
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            fontSize: '14px'
          }}>
            <div>
              <div style={{ color: '#64748b' }}>Frontend Port</div>
              <div style={{ fontWeight: '500' }}>3005</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Backend Port</div>
              <div style={{ fontWeight: '500' }}>5000</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Node Environment</div>
              <div style={{ fontWeight: '500' }}>{process.env.NODE_ENV || 'development'}</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
