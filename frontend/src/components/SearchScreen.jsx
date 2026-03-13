import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { resolveDestination, fetchTerrain, getLanguages } from '../utils/api'

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

export default function SearchScreen() {
  const { setPhase, setDestination, setDestData, setTerrainData, setLanguage,
          language, setLoadingStep, setError, error } = useStore()

  const [input, setInput] = useState('')
  const [langs, setLangs] = useState(['English'])
  const [isLoading, setIsLoading] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(null)

  useEffect(() => {
    getLanguages().then(setLangs).catch(() => {})
  }, [])

  const handleExplore = async (dest = input) => {
    if (!dest.trim()) return
    setIsLoading(true)
    setError(null)
    setDestination(dest)

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

  return (
    <div style={styles.root}>
      {/* Background star field */}
      <div style={styles.stars} />

      {/* Header */}
      <div style={styles.header} className="fade-up">
        <div style={styles.logo}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#c8902a" strokeWidth="1.5"/>
            <path d="M6 16 Q10 8 16 16 Q22 24 26 16" stroke="#c8902a" strokeWidth="1.5" fill="none"/>
            <circle cx="16" cy="16" r="2" fill="#c8902a"/>
          </svg>
          <span style={{
  ...styles.logoText,
  background: 'linear-gradient(90deg, #ffffff 0%, #c8902a 100%)',
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
          <input
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExplore()}
            placeholder="Enter any place on Earth…"
            autoFocus
          />
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
          style={{...styles.exploreBtn, opacity: isLoading ? 0.6 : 1}}
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
                  borderColor: activeSuggestion === s ? '#c8902a' : 'rgba(200,144,42,0.25)',
                  color: activeSuggestion === s ? '#c8902a' : '#c8b090',
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
    background: `radial-gradient(1px 1px at 10% 15%, rgba(200,144,42,0.5) 0%, transparent 100%),
                 radial-gradient(1px 1px at 30% 45%, rgba(245,237,224,0.3) 0%, transparent 100%),
                 radial-gradient(1px 1px at 55% 20%, rgba(245,237,224,0.4) 0%, transparent 100%),
                 radial-gradient(1px 1px at 75% 60%, rgba(200,144,42,0.3) 0%, transparent 100%),
                 radial-gradient(1px 1px at 85% 25%, rgba(245,237,224,0.35) 0%, transparent 100%),
                 radial-gradient(1px 1px at 20% 70%, rgba(245,237,224,0.25) 0%, transparent 100%),
                 radial-gradient(1px 1px at 65% 80%, rgba(200,144,42,0.2) 0%, transparent 100%)`,
    pointerEvents: 'none',
  },
  header: {
    textAlign: 'center', marginBottom: '3rem',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    justifyContent: 'center', marginBottom: '0.5rem',
  },
  logoText: {
    fontFamily: 'Cinzel, serif', fontSize: '2rem',
    fontWeight: 900, letterSpacing: '0.15em',
    color: '#f5ede0',
  },
  tagline: {
    fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem',
    fontStyle: 'italic', color: '#8a7060', letterSpacing: '0.05em',
  },
  card: {
    width: '100%', maxWidth: '640px',
    background: 'rgba(13,11,8,0.85)',
    border: '1px solid rgba(200,144,42,0.25)',
    borderRadius: '2px',
    padding: '2.5rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,144,42,0.1)',
  },
  cardLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
    letterSpacing: '0.25em', color: '#c8902a',
    marginBottom: '1rem',
  },
  inputRow: {
    display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
  },
  input: {
    flex: 1,
    background: 'rgba(245,237,224,0.04)',
    border: '1px solid rgba(200,144,42,0.3)',
    borderRadius: '2px',
    padding: '0.85rem 1rem',
    color: '#f5ede0',
    fontSize: '1rem',
    fontFamily: 'Crimson Pro, serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    background: 'rgba(245,237,224,0.04)',
    border: '1px solid rgba(200,144,42,0.3)',
    borderRadius: '2px',
    padding: '0.85rem 0.75rem',
    color: '#c8b090',
    fontSize: '0.85rem',
    outline: 'none',
    cursor: 'pointer',
  },
  exploreBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #c8902a, #8a6218)',
    border: 'none',
    borderRadius: '2px',
    padding: '1rem',
    color: '#f5ede0',
    fontSize: '0.75rem',
    fontFamily: 'Cinzel, serif',
    letterSpacing: '0.2em',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.1s',
    marginBottom: '2rem',
  },
  error: {
    color: '#e07050', fontSize: '0.9rem', marginBottom: '1rem',
    fontFamily: 'Crimson Pro, serif',
  },
  suggestions: { borderTop: '1px solid rgba(200,144,42,0.1)', paddingTop: '1.5rem' },
  suggestLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.2em', color: '#6a5040',
    marginBottom: '0.75rem',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip: {
    background: 'transparent',
    border: '1px solid rgba(200,144,42,0.25)',
    borderRadius: '1px',
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'Crimson Pro, serif',
    color: '#c8b090',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  footer: {
    position: 'absolute', bottom: '1.5rem',
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em', color: '#3a3028',
  },
}
