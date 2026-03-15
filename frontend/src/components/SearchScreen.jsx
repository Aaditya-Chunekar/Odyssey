import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { resolveDestination, fetchTerrain, fetchSatellite, getLanguages } from '../utils/api'

const SUGGESTIONS = [
  'Mount Fuji, Japan',
  'Grand Canyon, USA',
  'Swiss Alps',
  'Patagonia, Argentina',
  'Dolomites, Italy',
  'Kilimanjaro, Tanzania',
  'Santorini, Greece',
  'Machu Picchu, Peru',
]

const HISTORY_KEY = 'terravoice_history'
const MAX_HISTORY = 12

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(dest) {
  const prev = loadHistory().filter(d => d.toLowerCase() !== dest.toLowerCase())
  const next = [dest, ...prev].slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}
function deleteFromHistory(dest) {
  const next = loadHistory().filter(d => d !== dest)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export default function SearchScreen() {
  const { setPhase, setDestination, setDestData, setTerrainData, setLanguage,
          setSatelliteImage, language, setLoadingStep, setError, error } = useStore()

  const [input, setInput]               = useState('')
  const [langs, setLangs]               = useState(['English'])
  const [isLoading, setIsLoading]       = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(null)
  const [history, setHistory]           = useState(loadHistory)
  const [showDropdown, setShowDropdown] = useState(false)
  const [hoverHistory, setHoverHistory] = useState(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => { getLanguages().then(setLangs).catch(() => {}) }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredHistory = input.trim()
    ? history.filter(d => d.toLowerCase().includes(input.toLowerCase()))
    : history

  const handleExplore = async (dest = input) => {
    if (!dest.trim()) return
    setShowDropdown(false)
    setIsLoading(true)
    setError(null)
    setDestination(dest)
    saveHistory(dest.trim())
    setHistory(loadHistory())

    try {
      setPhase('loading')
      setLoadingStep('Locating destination with Gemini…')
      const destData = await resolveDestination(dest, language)
      setDestData(destData)

      setLoadingStep('Fetching elevation data from AWS Terrain Tiles…')
      const terrain = await fetchTerrain(destData.name, destData.bounds)
      setTerrainData(terrain)

      setLoadingStep('Rendering 3D terrain…')
      await new Promise(r => setTimeout(r, 400))

      setPhase('terrain')
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Something went wrong.')
      setPhase('search')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (e, dest) => {
    e.stopPropagation()
    deleteFromHistory(dest)
    setHistory(loadHistory())
  }

  const handleClearAll = () => {
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  return (
    <div style={styles.root}>
      <div style={styles.stars} />

      {/* Header */}
      <div style={styles.header} className="fade-up">
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#e8a030" strokeWidth="1.5"/>
            <path d="M6 16 Q10 8 16 16 Q22 24 26 16" stroke="#e8a030" strokeWidth="1.5" fill="none"/>
            <circle cx="16" cy="16" r="2" fill="#e8a030"/>
          </svg>
          <span style={{
            ...styles.logoText,
            background: 'linear-gradient(90deg, #ffffff 0%, #e8a030 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>ODYSSEY</span>
        </div>
        <p style={styles.tagline}>Fly over the world. Hear its stories.</p>
      </div>

      {/* Search card */}
      <div style={styles.card} className="fade-up-1">
        <p style={styles.cardLabel}>DESTINATION</p>

        <div style={styles.inputRow}>
          {/* Input + history dropdown wrapper */}
          <div style={styles.inputWrap} ref={dropdownRef}>
            <input
              ref={inputRef}
              style={styles.input}
              value={input}
              onChange={e => { setInput(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleExplore()
                if (e.key === 'Escape') setShowDropdown(false)
              }}
              placeholder="Enter any place on Earth…"
              autoFocus
            />

            {/* History dropdown */}
            {showDropdown && filteredHistory.length > 0 && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <span style={styles.dropdownLabel}>
                    {input.trim() ? 'MATCHES' : 'RECENT'}
                  </span>
                  {!input.trim() && (
                    <button style={styles.clearAllBtn} onClick={handleClearAll}>
                      CLEAR ALL
                    </button>
                  )}
                </div>
                {filteredHistory.map(dest => (
                  <div
                    key={dest}
                    style={{
                      ...styles.historyItem,
                      background: hoverHistory === dest
                        ? 'rgba(232,160,48,0.1)' : 'transparent',
                    }}
                    onMouseEnter={() => setHoverHistory(dest)}
                    onMouseLeave={() => setHoverHistory(null)}
                    onClick={() => { setInput(dest); handleExplore(dest) }}
                  >
                    <span style={styles.historyIcon}>◎</span>
                    <span style={styles.historyText}>{dest}</span>
                    <button
                      style={styles.deleteBtn}
                      onClick={e => handleDelete(e, dest)}
                      title="Remove"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <select
            style={styles.select}
            value={language}
            onChange={e => setLanguage(e.target.value)}
          >
            {langs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {error && <p style={styles.error}>⚠ {error}</p>}

        <button
          style={{ ...styles.exploreBtn, opacity: isLoading ? 0.6 : 1 }}
          onClick={() => handleExplore()}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'CHARTING COURSE…' : 'EXPLORE TERRAIN →'}
        </button>

        {/* Suggestions */}
        <div style={styles.suggestions}>
          <p style={styles.suggestLabel}>DISCOVER</p>
          <div style={styles.chips}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                style={{
                  ...styles.chip,
                  borderColor: activeSuggestion === s ? '#e8a030' : 'rgba(232,160,48,0.35)',
                  color: activeSuggestion === s ? '#e8a030' : '#d4b888',
                  background: activeSuggestion === s ? 'rgba(232,160,48,0.08)' : 'transparent',
                }}
                onMouseEnter={() => setActiveSuggestion(s)}
                onMouseLeave={() => setActiveSuggestion(null)}
                onClick={() => { setInput(s); handleExplore(s) }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer} className="fade-up-3">
        <span>Powered by Gemini AI · AWS Terrain Tiles · Three.js</span>
      </div>
    </div>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 30%, #1a1208 0%, #0d0b08 70%)',
    padding: '2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  stars: {
    position: 'absolute', inset: 0,
    background: `radial-gradient(1px 1px at 10% 15%, rgba(232,160,48,0.7) 0%, transparent 100%),
                 radial-gradient(1px 1px at 30% 45%, rgba(245,237,224,0.5) 0%, transparent 100%),
                 radial-gradient(1px 1px at 55% 20%, rgba(245,237,224,0.6) 0%, transparent 100%),
                 radial-gradient(1px 1px at 75% 60%, rgba(232,160,48,0.5) 0%, transparent 100%),
                 radial-gradient(1px 1px at 85% 25%, rgba(245,237,224,0.55) 0%, transparent 100%),
                 radial-gradient(1px 1px at 20% 70%, rgba(245,237,224,0.45) 0%, transparent 100%),
                 radial-gradient(1px 1px at 65% 80%, rgba(232,160,48,0.4) 0%, transparent 100%)`,
    pointerEvents: 'none',
  },
  header: { textAlign: 'center', marginBottom: '3rem' },
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    justifyContent: 'center', marginBottom: '0.5rem',
  },
  logoText: {
    fontFamily: 'Playfair Display, serif', fontSize: '2rem',
    fontWeight: 900,  letterSpacing: '0.15em', color: '#f5ede0',
  },
  tagline: {
    fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem',
    fontStyle: 'italic', color: '#a08868', letterSpacing: '0.05em',
  },
  card: {
    width: '100%', maxWidth: '640px',
    background: 'rgba(13,11,8,0.92)',
    border: '1px solid rgba(232,160,48,0.45)',
    borderRadius: '2px',
    padding: '2.5rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.7), inset 0 1px 0 rgba(232,160,48,0.2)',
  },
  cardLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
    letterSpacing: '0.25em', color: '#e8a030',
    marginBottom: '1rem',
  },
  inputRow: {
    display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
    alignItems: 'flex-start',
  },
  inputWrap: {
    flex: 1, position: 'relative',
  },
  input: {
    width: '100%',
    background: 'rgba(245,237,224,0.06)',
    border: '1px solid rgba(232,160,48,0.5)',
    borderRadius: '2px',
    padding: '0.85rem 1rem',
    color: '#f5ede0',
    fontSize: '1rem',
    fontFamily: 'Crimson Pro, serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  dropdown: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
    background: '#100e0b',
    border: '1px solid rgba(232,160,48,0.45)',
    borderRadius: '2px',
    zIndex: 100,
    boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
    maxHeight: '260px',
    overflowY: 'auto',
  },
  dropdownHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0.85rem',
    borderBottom: '1px solid rgba(232,160,48,0.15)',
  },
  dropdownLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.2em', color: '#b07820',
  },
  clearAllBtn: {
    fontFamily: 'Cinzel, serif', fontSize: '0.5rem',
    letterSpacing: '0.15em', color: '#804010',
    background: 'transparent', border: 'none',
    cursor: 'pointer', padding: '0.1rem 0.3rem',
    transition: 'color 0.2s',
  },
  historyItem: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.6rem 0.85rem',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(232,160,48,0.06)',
    transition: 'background 0.15s',
  },
  historyIcon: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    color: '#b07820', flexShrink: 0,
  },
  historyText: {
    flex: 1,
    fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem',
    color: '#d4b888',
  },
  deleteBtn: {
    background: 'transparent', border: 'none',
    color: '#6a4a28', fontSize: '0.65rem',
    cursor: 'pointer', padding: '0.1rem 0.25rem',
    flexShrink: 0, transition: 'color 0.2s',
    fontFamily: 'monospace',
  },
  select: {
    background: 'rgba(245,237,224,0.06)',
    border: '1px solid rgba(232,160,48,0.5)',
    borderRadius: '2px',
    padding: '0.85rem 0.75rem',
    color: '#d4b888',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  exploreBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #e8a030, #b07820)',
    border: 'none', borderRadius: '2px', padding: '1rem',
    color: '#f5ede0', fontSize: '0.75rem',
    fontFamily: 'Cinzel, serif', letterSpacing: '0.2em',
    fontWeight: 600, cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.1s',
    marginBottom: '2rem',
  },
  error: {
    color: '#e07050', fontSize: '0.9rem', marginBottom: '1rem',
    fontFamily: 'Crimson Pro, serif',
  },
  suggestions: {
    borderTop: '1px solid rgba(232,160,48,0.2)',
    paddingTop: '1.5rem',
  },
  suggestLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.2em', color: '#8a6840',
    marginBottom: '0.75rem',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip: {
    background: 'transparent',
    border: '1px solid rgba(232,160,48,0.35)',
    borderRadius: '1px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'Crimson Pro, serif',
    color: '#d4b888',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  footer: {
    position: 'absolute', bottom: '1.5rem',
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em', color: '#5a4830',
  },
}