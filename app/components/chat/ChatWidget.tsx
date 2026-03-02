'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, ChatMessageData } from './ChatMessage';

const STORAGE_KEY = 'novapress_chat_history';
const SESSION_KEY = 'novapress_chat_session';

function loadHistory(): ChatMessageData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessageData[]) {
  try {
    // Keep last 30 messages in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  } catch {
    // Storage full — ignore
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load history on mount
  useEffect(() => {
    setMessages(loadHistory());
    const sid = localStorage.getItem(SESSION_KEY) || '';
    if (sid) setSessionId(sid);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // Save history when messages change
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NEXT_PUBLIC_WS_URL
      ? process.env.NEXT_PUBLIC_WS_URL.replace(/^https?:/, wsProto)
      : (window.location.hostname === 'localhost' ? 'ws://localhost:5000' : `${wsProto}//${window.location.host}`);
    const wsUrl = `${wsHost}/ws/chat`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            if (data.session_id) {
              setSessionId(data.session_id);
              localStorage.setItem(SESSION_KEY, data.session_id);
            }
            break;

          case 'typing':
            setTyping(!!data.content);
            break;

          case 'response':
            setTyping(false);
            const assistantMsg: ChatMessageData = {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: data.content,
              timestamp: data.timestamp || new Date().toISOString(),
            };
            setMessages(prev => [...prev, assistantMsg]);
            if (data.remaining !== undefined) {
              setRemaining(data.remaining);
            }
            break;

          case 'error':
            setTyping(false);
            const errorMsg: ChatMessageData = {
              id: `e-${Date.now()}`,
              role: 'system',
              content: data.content || 'Erreur',
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
            break;

          case 'pong':
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  // Connect when widget opens, disconnect when closed
  useEffect(() => {
    if (open) {
      connectWs();
      setTimeout(() => inputRef.current?.focus(), 100);
    }

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [open, connectWs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  // Ping keep-alive
  useEffect(() => {
    if (!open || !connected) return;
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [open, connected]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMsg: ChatMessageData = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    wsRef.current.send(JSON.stringify({
      type: 'message',
      content: text,
      session_id: sessionId,
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_KEY);
    setSessionId('');
    setRemaining(null);
  };

  // ─── Styles ───

  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 9999,
    transition: 'transform 0.2s ease',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 90,
    right: 24,
    width: 380,
    maxWidth: 'calc(100vw - 48px)',
    height: 520,
    maxHeight: 'calc(100vh - 120px)',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderBottom: '1px solid #E5E5E5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
  };

  const footerStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderTop: '1px solid #E5E5E5',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #E5E5E5',
    borderRadius: '20px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
  };

  const sendBtnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: input.trim() ? '#1A1A1A' : '#D1D5DB',
    color: '#FFFFFF',
    border: 'none',
    cursor: input.trim() ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    transition: 'background-color 0.15s ease',
  };

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A1A' }}>
                Alex
              </span>
              <span style={{
                fontSize: '11px',
                color: '#6B7280',
                fontStyle: 'italic',
              }}>
                NovaPress AI
              </span>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: connected ? '#22C55E' : '#EF4444',
                display: 'inline-block',
              }} />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={clearHistory}
                title="Effacer l'historique"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#9CA3AF',
                  padding: '4px',
                }}
              >
                &#x1F5D1;
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#6B7280',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={bodyStyle}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#9CA3AF',
                fontSize: '13px',
                marginTop: '40px',
                lineHeight: 1.6,
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#x1F4F0;</div>
                <strong>Bienvenue !</strong><br/>
                Pose-moi tes questions sur l&apos;actualite.<br/>
                Je m&apos;appuie sur les syntheses NovaPress.
              </div>
            )}
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {typing && (
              <div style={{
                fontSize: '13px',
                color: '#9CA3AF',
                fontStyle: 'italic',
                padding: '4px 0',
              }}>
                Alex ecrit...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div style={footerStyle}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question..."
              style={inputStyle}
              disabled={!connected}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !connected}
              style={sendBtnStyle}
              title="Envoyer"
            >
              &#x27A4;
            </button>
          </div>

          {/* Rate limit indicator */}
          {remaining !== null && remaining <= 2 && (
            <div style={{
              padding: '4px 12px',
              backgroundColor: remaining === 0 ? '#FEF2F2' : '#FFFBEB',
              fontSize: '11px',
              color: remaining === 0 ? '#DC2626' : '#D97706',
              textAlign: 'center',
              borderTop: '1px solid #E5E5E5',
            }}>
              {remaining === 0
                ? 'Limite atteinte (5/jour). Passez a PRO pour un acces illimite.'
                : `${remaining} message${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''} aujourd'hui`}
            </div>
          )}
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setOpen(!open)}
        style={fabStyle}
        title={open ? 'Fermer le chat' : 'Discuter avec Alex'}
        aria-label={open ? 'Fermer le chat' : 'Ouvrir le chat'}
      >
        {open ? '\u00D7' : '\uD83D\uDCAC'}
      </button>
    </>
  );
}
