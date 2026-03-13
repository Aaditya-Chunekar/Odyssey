import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { useVoiceGuide } from '../hooks/useVoiceGuide'
import { fetchNarration } from '../utils/api'

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
      const data = await fetchNarration(
        destData.name, destData.bounds, language,
        cameraPosition
      )
      setNarration(data.narration)
      speakText(data.narration, language)
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

    if (listening) {
      recognizerRef.current?.stop()
      setListening(false)
      return
    }

    const rec = new SR()
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript
      setInput(text)
      setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
    recognizerRef.current = rec
    setListening(true)
  }

  return (
    <div style={styles.panel}>
      {/* Narration section */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>TOUR NARRATION</p>
        {narration ? (
          <p style={styles.narrationText}>{narration}</p>
        ) : (
          <p style={styles.placeholder}>
            Generate an immersive narration about your current view.
          </p>
        )}
        <button
          style={{...styles.btn, ...styles.btnPrimary, opacity: loadingNarration ? 0.6 : 1}}
          onClick={handleNarrate}
          disabled={loadingNarration}
        >
          {loadingNarration ? '◌ GENERATING…' : '◈ NARRATE VIEW'}
        </button>
        {isSpeaking && (
          <div style={styles.speaking}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                ...styles.bar,
                animationDelay: `${i * 0.1}s`,
                height: `${Math.random() * 12 + 6}px`,
              }} />
            ))}
            <span style={styles.speakingLabel}>Speaking…</span>
          </div>
        )}
      </div>

      {/* Voice guide chat */}
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
              background: m.role === 'user' ? 'rgba(200,144,42,0.12)'
                        : m.role === 'error' ? 'rgba(180,60,40,0.15)'
                        : 'rgba(245,237,224,0.04)',
              borderColor: m.role === 'user' ? 'rgba(200,144,42,0.3)'
                         : m.role === 'error' ? 'rgba(180,60,40,0.3)'
                         : 'rgba(245,237,224,0.08)',
              color: m.role === 'error' ? '#e08060' : '#c8b090',
            }}>
              <span style={styles.msgRole}>
                {m.role === 'user' ? 'YOU' : m.role === 'guide' ? 'GUIDE' : '—'}
              </span>
              {m.text}
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
              style={{...styles.btn, ...styles.btnMic, background: listening ? 'rgba(200,80,50,0.3)' : undefined}}
              onClick={toggleListen}
              title="Voice input"
            >🎤</button>
            <button
              style={{...styles.btn, ...styles.btnSend}}
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
    display: 'flex', flexDirection: 'column', gap: '0',
    height: '100%', overflowY: 'auto',
  },
  section: {
    padding: '1.25rem',
    borderBottom: '1px solid rgba(200,144,42,0.1)',
  },
  sectionLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.25em', color: '#c8902a',
    marginBottom: '0.75rem',
  },
  narrationText: {
    fontFamily: 'Crimson Pro, serif', fontStyle: 'italic',
    fontSize: '0.95rem', lineHeight: 1.7, color: '#c8b090',
    marginBottom: '0.75rem',
  },
  placeholder: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem',
    color: '#4a3a28', fontStyle: 'italic', marginBottom: '0.75rem',
  },
  btn: {
    fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
    letterSpacing: '0.15em', borderRadius: '1px',
    padding: '0.5rem 1rem', border: '1px solid',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  btnPrimary: {
    background: 'rgba(200,144,42,0.15)',
    borderColor: 'rgba(200,144,42,0.4)',
    color: '#c8902a', width: '100%',
  },
  btnSecondary: {
    background: 'transparent',
    borderColor: 'rgba(200,144,42,0.3)',
    color: '#8a7060',
  },
  btnDanger: {
    background: 'rgba(180,60,40,0.15)',
    borderColor: 'rgba(180,60,40,0.3)',
    color: '#e08060',
  },
  btnSend: {
    background: 'rgba(200,144,42,0.2)',
    borderColor: 'rgba(200,144,42,0.4)',
    color: '#c8902a', padding: '0.5rem 0.75rem',
  },
  btnMic: {
    background: 'rgba(245,237,224,0.04)',
    borderColor: 'rgba(200,144,42,0.2)',
    color: '#c8b090', padding: '0.5rem 0.5rem',
    fontSize: '0.9rem',
  },
  speaking: {
    display: 'flex', alignItems: 'center', gap: '3px',
    marginTop: '0.5rem',
  },
  bar: {
    width: 3, background: '#c8902a', borderRadius: 2,
    animation: 'waveform 0.5s ease infinite alternate',
  },
  speakingLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em', color: '#c8902a', marginLeft: '0.5rem',
  },
  guideHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '0.75rem',
  },
  messages: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    maxHeight: '220px', overflowY: 'auto',
    marginBottom: '0.75rem',
    minHeight: '60px',
  },
  msgEmpty: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem',
    color: '#3a3028', fontStyle: 'italic', textAlign: 'center',
    padding: '1rem 0',
  },
  msg: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem',
    lineHeight: 1.5, padding: '0.5rem 0.75rem',
    border: '1px solid', borderRadius: '1px',
    maxWidth: '90%',
  },
  msgRole: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em', display: 'block',
    marginBottom: '0.2rem', opacity: 0.6,
  },
  inputRow: {
    display: 'flex', gap: '0.4rem',
  },
  chatInput: {
    flex: 1,
    background: 'rgba(245,237,224,0.04)',
    border: '1px solid rgba(200,144,42,0.25)',
    borderRadius: '1px',
    padding: '0.5rem 0.75rem',
    color: '#c8b090', fontSize: '0.9rem',
    fontFamily: 'Crimson Pro, serif', outline: 'none',
  },
}
