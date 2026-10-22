import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { MessageCircle, X, Send, Bot, User, Minimize2, Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

const API = `${API_BASE_URL}`;

// Inject keyframe animation once into <head>
if (typeof document !== 'undefined' && !document.getElementById('chat-widget-kf')) {
  const s = document.createElement('style');
  s.id = 'chat-widget-kf';
  s.textContent = '@keyframes cwIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}';
  document.head.appendChild(s);
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface Suggestion {
  text: string;
  icon: string;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" data-link="true" style="color:#4f46e5;text-decoration:underline;font-weight:500">$1</a>');
}

function MessageBubble({ msg }: { msg: Message }) {
  const { t } = useTranslation();
  const isBot = msg.role === 'assistant';
  return (
    <div style={{ display: 'flex', gap: '10px', flexDirection: isBot ? 'row' : 'row-reverse', alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: isBot ? 'linear-gradient(135deg,#6366f1,#7c3aed)' : 'linear-gradient(135deg,#475569,#1e293b)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isBot ? <Bot style={{ width: 14, height: 14, color: 'white' }} /> : <User style={{ width: 14, height: 14, color: 'white' }} />}
      </div>
      <div style={{
        maxWidth: '82%', borderRadius: 16, padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
        background: isBot ? '#fff' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
        color: isBot ? '#1e293b' : '#fff',
        border: isBot ? '1px solid #f1f5f9' : 'none',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        {msg.isStreaming && msg.content === '' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
            <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 12 }}>{t('chatWidget.thinking')}</span>
          </span>
        ) : isBot ? (
          <span dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
        ) : (
          <span>{msg.content}</span>
        )}
        {msg.isStreaming && msg.content !== '' && (
          <span style={{ display: 'inline-block', width: 6, height: 16, background: '#818cf8', animation: 'pulse 1s ease-in-out infinite', marginLeft: 2, verticalAlign: 'middle', borderRadius: 2 }} />
        )}
      </div>
    </div>
  );
}

export function ChatWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [bounced, setBounced] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const { token } = useCart();

  useEffect(() => {
    fetch(`${API}/chat/suggestions`).then(r => r.json()).then(setSuggestions).catch(() => {});
    const t = setTimeout(() => setBounced(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest('a[data-link="true"]') as HTMLAnchorElement | null;
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute('href') || '';
    if (href.startsWith('/')) { navigate(href); setIsOpen(false); }
    else window.open(href, '_blank');
  }, [navigate]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const uid = Date.now().toString();
    const bid = (Date.now() + 1).toString();
    setMessages(p => [...p, { id: uid, role: 'user', content: text.trim() }, { id: bid, role: 'assistant', content: '', isStreaming: true }]);
    setInput('');
    setIsLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    abortRef.current = new AbortController();

    try {
      const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) hdrs['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/chat/message`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ message: text.trim(), history }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]' || !t.startsWith('data: ')) continue;
          try {
            const j = JSON.parse(t.slice(6));
            if (j.text) { acc += j.text; setMessages(p => p.map(m => m.id === bid ? { ...m, content: acc, isStreaming: true } : m)); }
          } catch { /**/ }
        }
      }
      setMessages(p => p.map(m => m.id === bid ? { ...m, isStreaming: false } : m));
    } catch (e: any) {
      const msg = e.name === 'AbortError' ? t('chatWidget.stopped') : t('chatWidget.errorTryAgain');
      setMessages(p => p.map(m => m.id === bid ? { ...m, content: msg, isStreaming: false } : m));
    } finally { setIsLoading(false); }
  }, [isLoading, messages, token]);

  return (
    <>
      {/* Floating button */}
      <button
        id="chat-widget-toggle"
        onClick={() => setIsOpen(o => !o)}
        aria-label={t('chatWidget.openChatbot')}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .2s, box-shadow .2s',
          animation: bounced && !isOpen ? 'bounce 1s infinite' : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
      >
        {isOpen ? <X style={{ width: 24, height: 24, color: 'white' }} /> : <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />}
        {!isOpen && (
          <span style={{
            position: 'absolute', top: -4, right: -4, width: 16, height: 16,
            background: '#f43f5e', borderRadius: '50%', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 8, height: 8, color: 'white' }} />
          </span>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          id="chat-widget-window"
          style={{
            position: 'fixed', bottom: 96, right: 24, zIndex: 9999,
            width: 'min(400px, calc(100vw - 1.5rem))',
            height: 'clamp(480px, 60vh, 580px)',
            display: 'flex', flexDirection: 'column',
            borderRadius: 20, border: '1px solid #e2e8f0',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            background: 'white', overflow: 'hidden',
            animation: 'cwIn .2s ease-out',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'linear-gradient(to right,#4f46e5,#7c3aed)', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{t('chatWidget.assistantTitle')}</p>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { onClick: () => { setMessages([]); setIsOpen(false); setTimeout(() => setIsOpen(true), 50); }, icon: <Minimize2 style={{ width: 14, height: 14 }} />, title: t('chatWidget.newChat') },
                { onClick: () => setIsOpen(false), icon: <X style={{ width: 14, height: 14 }} />, title: t('chatWidget.close') },
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} title={btn.title} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >{btn.icon}</button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div
            onClick={handleClick}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(248,250,252,0.5)' }}
          >
            {messages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MessageBubble msg={{ id: 'welcome', role: 'assistant', content: t('chatWidget.welcomeMessage') }} />
                {suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => send(s.text)}
                        style={{ textAlign: 'left', fontSize: 12, padding: '10px 12px', borderRadius: 12, border: '1px solid #e0e7ff', background: 'white', color: '#4338ca', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
                      >
                        <span style={{ fontSize: 14 }}>{s.icon}</span>{s.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', background: 'white', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={t('chatWidget.inputPlaceholder')}
                rows={1}
                disabled={isLoading}
                style={{ flex: 1, resize: 'none', fontSize: 13, padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', background: 'white', minHeight: 42, maxHeight: 80, lineHeight: 1.5, fontFamily: 'inherit', color: '#1e293b' }}
              />
              <button
                onClick={isLoading ? () => abortRef.current?.abort() : () => send(input)}
                disabled={!isLoading && !input.trim()}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isLoading ? '#fee2e2' : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  color: isLoading ? '#ef4444' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: !isLoading && !input.trim() ? 0.4 : 1,
                  boxShadow: isLoading ? 'none' : '0 2px 8px rgba(99,102,241,0.3)',
                }}
                title={isLoading ? t('chatWidget.stop') : t('chatWidget.send')}
              >
                {isLoading ? <X style={{ width: 16, height: 16 }} /> : <Send style={{ width: 16, height: 16 }} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>Powered by AI · Modern Book</p>
          </div>
        </div>
      )}
    </>
  );
}
