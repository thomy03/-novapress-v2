'use client';

import { memo } from 'react';

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

function renderMarkdown(text: string): string {
  // Minimal markdown: bold, italic, links, code, lists
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#F3F4F6;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#2563EB;text-decoration:underline">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/\n/g, '<br/>');
}

function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const bubbleStyle: React.CSSProperties = {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    backgroundColor: isUser ? '#1A1A1A' : '#F5F5F5',
    color: isUser ? '#FFFFFF' : '#1A1A1A',
    fontSize: '14px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
    alignSelf: isUser ? 'flex-end' as const : 'flex-start' as const,
  };

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isUser ? 'flex-end' : 'flex-start',
    marginBottom: '8px',
  };

  const timeStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#9CA3AF',
    marginTop: '4px',
    fontFamily: 'system-ui, sans-serif',
  };

  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div style={wrapperStyle}>
      {!isUser && (
        <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px', fontWeight: 600 }}>
          Alex
        </div>
      )}
      <div
        style={bubbleStyle}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
      />
      {time && <span style={timeStyle}>{time}</span>}
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);
