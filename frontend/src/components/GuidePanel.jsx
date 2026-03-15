import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useVoiceGuide } from '../hooks/useVoiceGuide'
import { fetchNarration } from '../utils/api'

// ─── Minimal markdown renderer ────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, # headings, - bullet lists
// No external dep needed — keeps bundle small
function renderMarkdown(text) {
  if (!text) return null

  const lines = text.split('\n')
  const elements = []
  let key = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (!line.trim()) { i++; continue }

    // Heading: ## or #
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes = { 1: '1.05rem', 2: '0.95rem', 3: '0.88rem' }
      elements.push(
        <p key={key++} style={{ ...mdStyles.heading, fontSize: sizes[level] }}>
          {inlineMarkdown(headingMatch[2])}
        </p>
      )
      i++; continue
    }

    // Bullet list: collect consecutive - / * lines
    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={key++} style={mdStyles.ul}>
          {items.map((item, j) => (
            <li key={j} style={mdStyles.li}>{inlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Normal paragraph
    elements.push(
      <p key={key++} style={mdStyles.p}>
        {inlineMarkdown(line)}
      </p>
    )
    i++
  }

  return <>{elements}</>
}

// Inline: **bold**, *italic*, `code`
function inlineMarkdown(text) {
  // Split on inline tokens, preserving delimiters
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (/^\*\*(.+)\*\*$/.test(part)) {
      return <strong key={i} style={mdStyles.bold}>{part.slice(2, -2)}</strong>
    }
    if (/^\*([^*]+)\*$/.test(part)) {
      return <em key={i} style={mdStyles.em}>{part.slice(1, -1)}</em>
    }
    if (/^`([^`]+)`$/.test(part)) {
      return <code key={i} style={mdStyles.code}>{part.slice(1, -1)}</code>
    }
    return part
  })
}

const mdStyles = {
  p:       { fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.7, color: '#d4b888', marginBottom: '0.4rem' },
  heading: { fontFamily: 'Cinzel, serif', letterSpacing: '0.08em', color: '#e8a030', marginBottom: '0.35rem', fontWeight: 600 },
  ul:      { paddingLeft: '1rem', marginBottom: '0.4rem' },
  li:      { fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', lineHeight: 1.6, color: '#d4b888', marginBottom: '0.2rem', listStyleType: '\'◦ \'' },
  bold:    { fontWeight: 700, fontStyle: 'normal', color: '#f0d090' },
  em:      { fontStyle: 'italic', color: '#d4b888' },
  code:    { fontFamily: 'monospace', fontSize: '0.82rem', background: 'rgba(232,160,48,0.12)', color: '#e8a030', padding: '0.1em 0.35em', borderRadius: '2px' },
}

// Render markdown but strip it for TTS (speak plain text)
function stripMarkdown(text) {
  return text
    .replace(/#{1,3}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .trim()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GuidePanel() {
  const {
    guideConnected, guideMessages, isSpeaking, destData,
    language, terrainData, cameraPosition,
    setNarration, narration,
  } = useStore()

  const { connect, disconnect, sendQuestion, speakText } = useVoiceGuide()
  const [input, setInput] = useState('')
  const [loadingNarration, setLoadingNarration] = useState(false)
  const [listening, setListening] = useState(false)
  const msgEndRef = useRef(null)
  const recognizerRef = useRef(null)

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [guideMessages])

  const handleNarrate = async () => {
    if (!destData) return
    setLoadingNarration(true)
    try {
      const data = await fetchNarration(destData.name, destData.bounds, language, cameraPosition)
      setNarration(data.narration)
      speakText(stripMarkdown(data.narration), language)
    } catch {
      setNarration('Could not generate narration.')
    } finally {
      setLoadingNarration(false)
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    sendQuestion(input.trim())
    setInput('')
  }

  const toggleListen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Speech recognition not supported in this browser.')
    if (listening) { recognizerRef.current?.stop(); setListening(false); return }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = e => { setInput(e.results[0][0].transcript); setListening(false) }
    rec.onend   = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    recognizerRef.current = rec
    setListening(true)
  }

  return (
    <div style={styles.panel}>

      {/* Narration */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>TOUR NARRATION</p>
        <div style={styles.narrationBox}>
          {narration
            ? renderMarkdown(narration)
            : <p style={styles.placeholder}>Generate an immersive narration about your current view.</p>
          }
        </div>
        <button
          style={{ ...styles.btn, ...styles.btnPrimary, opacity: loadingNarration ? 0.6 : 1 }}
          onClick={handleNarrate}
          disabled={loadingNarration}
        >
          {loadingNarration ? '◌ GENERATING…' : '◈ NARRATE VIEW'}
        </button>
        {isSpeaking && (
          <div style={styles.speaking}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ ...styles.bar, animationDelay: `${i * 0.1}s` }} />
            ))}
            <span style={styles.speakingLabel}>Speaking…</span>
          </div>
        )}
      </div>

      {/* Live guide chat */}
      <div style={styles.section}>
        <div style={styles.guideHeader}>
          <p style={styles.sectionLabel}>LIVE GUIDE</p>
          <button
            style={{
              ...styles.btn,
              ...(guideConnected ? styles.btnDanger : styles.btnSecondary),
              fontSize: '0.6rem', padding: '0.25rem 0.6rem',
            }}
            onClick={guideConnected ? disconnect : connect}
          >
            {guideConnected ? '● DISCONNECT' : '○ CONNECT'}
          </button>
        </div>

        <div style={styles.messages}>
          {guideMessages.length === 0 && (
            <p style={styles.msgEmpty}>Connect to start chatting with your guide.</p>
          )}
          {guideMessages.map((m, i) => (
            <div key={i} style={{
              ...styles.msg,
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user'  ? 'rgba(232,160,48,0.12)'
                        : m.role === 'error' ? 'rgba(180,60,40,0.15)'
                        : 'rgba(245,237,224,0.05)',
              borderColor: m.role === 'user'  ? 'rgba(232,160,48,0.45)'
                         : m.role === 'error' ? 'rgba(180,60,40,0.4)'
                         : 'rgba(245,237,224,0.12)',
            }}>
              <span style={styles.msgRole}>
                {m.role === 'user' ? 'YOU' : m.role === 'guide' ? 'GUIDE' : '—'}
              </span>
              {/* user messages are plain text; guide/system get markdown */}
              {m.role === 'user'
                ? <span style={{ color: '#d4b888', fontSize: '0.85rem', fontFamily: 'Crimson Pro, serif' }}>{m.text}</span>
                : renderMarkdown(m.text)
              }
            </div>
          ))}
          <div ref={msgEndRef} />
        </div>

        {guideConnected && (
          <div style={styles.inputRow}>
            <input
              style={styles.chatInput}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about the terrain…"
            />
            <button
              style={{ ...styles.btn, ...styles.btnMic, background: listening ? 'rgba(200,80,50,0.3)' : undefined }}
              onClick={toggleListen}
              title="Voice input"
            >🎤</button>
            <button
              style={{ ...styles.btn, ...styles.btnSend }}
              onClick={handleSend}
              disabled={!input.trim()}
            >→</button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  panel: {
    display: 'flex', flexDirection: 'column',
    height: '100%', overflowY: 'auto',
  },
  section: {
    padding: '1.25rem',
    borderBottom: '1px solid rgba(232,160,48,0.15)',
  },
  sectionLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.25em', color: '#e8a030',
    marginBottom: '0.75rem',
  },
  narrationBox: {
    marginBottom: '0.75rem',
    display: 'flex', flexDirection: 'column', gap: '0.1rem',
  },
  placeholder: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem',
    color: '#6a5038', fontStyle: 'italic',
  },
  btn: {
    fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
    letterSpacing: '0.15em', borderRadius: '1px',
    padding: '0.5rem 1rem', border: '1px solid',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  btnPrimary: {
    background: 'rgba(232,160,48,0.15)',
    borderColor: 'rgba(232,160,48,0.5)',
    color: '#e8a030', width: '100%',
  },
  btnSecondary: {
    background: 'transparent',
    borderColor: 'rgba(232,160,48,0.4)',
    color: '#a08060',
  },
  btnDanger: {
    background: 'rgba(180,60,40,0.18)',
    borderColor: 'rgba(180,60,40,0.45)',
    color: '#e08060',
  },
  btnSend: {
    background: 'rgba(232,160,48,0.2)',
    borderColor: 'rgba(232,160,48,0.5)',
    color: '#e8a030', padding: '0.5rem 0.75rem',
  },
  btnMic: {
    background: 'rgba(245,237,224,0.05)',
    borderColor: 'rgba(232,160,48,0.3)',
    color: '#c8b090', padding: '0.5rem 0.5rem',
    fontSize: '0.9rem',
  },
  speaking: {
    display: 'flex', alignItems: 'center', gap: '3px', marginTop: '0.6rem',
  },
  bar: {
    width: 3, height: 14, background: '#e8a030', borderRadius: 2,
    animation: 'waveform 0.5s ease infinite alternate',
  },
  speakingLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em', color: '#e8a030', marginLeft: '0.5rem',
  },
  guideHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '0.75rem',
  },
  messages: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    maxHeight: '260px', overflowY: 'auto',
    marginBottom: '0.75rem', minHeight: '60px',
  },
  msgEmpty: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem',
    color: '#4a3a28', fontStyle: 'italic', textAlign: 'center',
    padding: '1rem 0',
  },
  msg: {
    fontSize: '0.85rem', lineHeight: 1.55,
    padding: '0.55rem 0.75rem',
    border: '1px solid', borderRadius: '1px',
    maxWidth: '92%',
  },
  msgRole: {
    fontFamily: 'Cinzel, serif', fontSize: '0.52rem',
    letterSpacing: '0.15em', display: 'block',
    marginBottom: '0.25rem', color: '#8a6840',
  },
  inputRow: { display: 'flex', gap: '0.4rem' },
  chatInput: {
    flex: 1,
    background: 'rgba(245,237,224,0.05)',
    border: '1px solid rgba(232,160,48,0.35)',
    borderRadius: '1px',
    padding: '0.5rem 0.75rem',
    color: '#d4b888', fontSize: '0.9rem',
    fontFamily: 'Crimson Pro, serif', outline: 'none',
  },
}