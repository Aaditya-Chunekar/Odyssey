import React from 'react'
import { useStore } from '../store'

export default function DestinationInfo() {
  const { destData, terrainData, language } = useStore()
  if (!destData) return null

  const { name, country, description, fun_facts, bounds, best_languages } = destData
  const elev = terrainData
    ? `${Math.round(terrainData.min_elev)}m – ${Math.round(terrainData.max_elev)}m`
    : '—'

  return (
    <div style={styles.root}>
      <div style={styles.nameBlock}>
        <p style={styles.country}>{country}</p>
        <h1 style={styles.name}>{name}</h1>
        <div style={styles.divider} />
        <p style={styles.desc}>{description}</p>
      </div>

      <div style={styles.statsRow}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>ELEVATION</span>
          <span style={styles.statValue}>{elev}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>GUIDE LANG</span>
          <span style={styles.statValue}>{language}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>LOCAL LANGS</span>
          <span style={styles.statValue}>{(best_languages || []).join(', ')}</span>
        </div>
      </div>

      {fun_facts && fun_facts.length > 0 && (
        <div style={styles.facts}>
          <p style={styles.factsLabel}>FIELD NOTES</p>
          {fun_facts.map((f, i) => (
            <div key={i} style={styles.fact}>
              <span style={styles.factNum}>0{i + 1}</span>
              <span style={styles.factText}>{f}</span>
            </div>
          ))}
        </div>
      )}

      {bounds && (
        <div style={styles.coords}>
          <p style={styles.factsLabel}>BOUNDS</p>
          <p style={styles.coordText}>
            {bounds.north.toFixed(3)}°N · {bounds.south.toFixed(3)}°S<br />
            {bounds.west.toFixed(3)}°W · {bounds.east.toFixed(3)}°E
          </p>
        </div>
      )}
    </div>
  )
}

const styles = {
  root: {
    padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
    overflowY: 'auto', height: '100%',
  },
  nameBlock: {},
  country: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.25em', color: '#c8902a',
    marginBottom: '0.25rem',
  },
  name: {
    fontFamily: 'Cinzel, serif', fontSize: '1.3rem',
    fontWeight: 600, color: '#f5ede0', lineHeight: 1.2,
    marginBottom: '0.75rem',
  },
  divider: {
    width: 40, height: 1,
    background: 'linear-gradient(to right, #c8902a, transparent)',
    marginBottom: '0.75rem',
  },
  desc: {
    fontFamily: 'Crimson Pro, serif', fontStyle: 'italic',
    fontSize: '0.95rem', lineHeight: 1.65, color: '#9a8878',
  },
  statsRow: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(200,144,42,0.1)',
    borderRadius: '1px', padding: '0.75rem',
  },
  stat: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.2em', color: '#5a4a38',
  },
  statValue: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem',
    color: '#c8b090',
  },
  facts: {},
  factsLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.25em', color: '#c8902a',
    marginBottom: '0.75rem',
  },
  fact: {
    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    marginBottom: '0.6rem',
  },
  factNum: {
    fontFamily: 'Cinzel, serif', fontSize: '0.65rem',
    color: '#6a5038', flexShrink: 0, paddingTop: '0.1rem',
  },
  factText: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.875rem',
    lineHeight: 1.5, color: '#8a7868',
  },
  coords: {},
  coordText: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem',
    color: '#5a4a38', fontStyle: 'italic', lineHeight: 1.7,
  },
}
