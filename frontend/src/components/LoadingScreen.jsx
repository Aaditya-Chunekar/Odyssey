import React from 'react'
import { useStore } from '../store'

const STEPS = [
  'Locating destination with Gemini…',
  'Fetching elevation data from AWS Terrain Tiles…',
  'Rendering 3D terrain…',
]

export default function LoadingScreen() {
  const { loadingStep, destination } = useStore()
  const stepIndex = STEPS.indexOf(loadingStep)

  return (
    <div style={styles.root}>
      <div style={styles.content}>
        {/* Animated globe */}
        <div style={styles.globeWrap}>
          <div style={styles.globe}>
            <div style={styles.meridian} />
            <div style={{...styles.meridian, transform: 'rotateY(60deg)'}} />
            <div style={{...styles.meridian, transform: 'rotateY(120deg)'}} />
            <div style={styles.equator} />
            <div style={{...styles.equator, top: '25%', width: '75%', left: '12.5%'}} />
            <div style={{...styles.equator, top: '75%', width: '75%', left: '12.5%'}} />
            <div style={styles.dot} />
          </div>
        </div>

        <h2 style={styles.title}>CHARTING COURSE</h2>
        <p style={styles.dest}>{destination}</p>

        <div style={styles.steps}>
          {STEPS.map((step, i) => (
            <div key={step} style={{
              ...styles.step,
              opacity: i <= stepIndex ? 1 : 0.25,
              color: i === stepIndex ? '#c8902a' : i < stepIndex ? '#6a8060' : '#3a3028',
            }}>
              <span style={styles.stepDot}>
                {i < stepIndex ? '✓' : i === stepIndex ? '◈' : '○'}
              </span>
              {step}
            </div>
          ))}
        </div>

        <p style={styles.hint}>
          Results are cached — revisit any destination instantly.
        </p>
      </div>
    </div>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(ellipse at 50% 40%, #120e06 0%, #0d0b08 100%)',
  },
  content: {
    textAlign: 'center', padding: '2rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
  },
  globeWrap: {
    width: 80, height: 80,
    animation: 'spin 4s linear infinite',
  },
  globe: {
    width: '100%', height: '100%',
    borderRadius: '50%',
    border: '1.5px solid rgba(200,144,42,0.6)',
    position: 'relative',
    transformStyle: 'preserve-3d',
    background: 'radial-gradient(circle at 35% 35%, rgba(200,144,42,0.08), transparent 70%)',
  },
  meridian: {
    position: 'absolute',
    width: '100%', height: '100%',
    borderRadius: '50%',
    border: '1px solid rgba(200,144,42,0.2)',
    top: 0, left: 0,
    transform: 'rotateY(0deg)',
  },
  equator: {
    position: 'absolute', left: 0,
    width: '100%', height: '1px',
    background: 'rgba(200,144,42,0.2)',
    top: '50%',
  },
  dot: {
    position: 'absolute', width: 6, height: 6,
    background: '#c8902a', borderRadius: '50%',
    top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    boxShadow: '0 0 8px rgba(200,144,42,0.8)',
  },
  title: {
    fontFamily: 'Cinzel, serif', fontSize: '1.4rem',
    letterSpacing: '0.35em', color: '#f5ede0', fontWeight: 600,
  },
  dest: {
    fontFamily: 'Crimson Pro, serif', fontStyle: 'italic',
    fontSize: '1.1rem', color: '#c8902a',
  },
  steps: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    alignItems: 'flex-start', textAlign: 'left',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(200,144,42,0.1)',
    borderRadius: '2px', padding: '1.25rem 1.5rem',
    minWidth: 320,
  },
  step: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    transition: 'all 0.3s',
  },
  stepDot: {
    fontFamily: 'Cinzel, serif', fontSize: '0.8rem', width: 16,
  },
  hint: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.1em', color: '#3a3028',
  },
}
