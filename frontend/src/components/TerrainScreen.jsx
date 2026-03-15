import React, { useState } from 'react'
import { useStore } from '../store'
import TerrainViewer from './TerrainViewer'
import GuidePanel from './GuidePanel'
import DestinationInfo from './DestinationInfo'

export default function TerrainScreen() {
  const { terrainData, destData, flyMode, setFlyMode, cameraPosition, reset } = useStore()
  const [sidePanel, setSidePanel] = useState('guide')
  const [showControls, setShowControls] = useState(false)

  if (!terrainData) return null

  return (
    <div style={styles.root}>
      <div style={styles.canvas}>
        <TerrainViewer terrainData={terrainData} flyMode={flyMode} />
      </div>

      {/* Top HUD */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={reset}>← BACK</button>

        <div style={styles.destName}>
          <span style={styles.destLabel}>{destData?.country}</span>
          <span style={styles.destTitle}>{destData?.name}</span>
        </div>

        <div style={styles.topRight}>
          <button
            style={{
              ...styles.hudBtn,
              background: flyMode ? 'rgba(200,144,42,0.25)' : 'rgba(13,11,8,0.7)',
              borderColor: flyMode ? 'rgba(200,144,42,0.6)' : 'rgba(200,144,42,0.2)',
              color: flyMode ? '#c8902a' : '#7a6a58',
            }}
            onClick={() => setFlyMode(!flyMode)}
          >
            {flyMode ? '✈ FLY MODE ON' : '✈ FLY MODE'}
          </button>
          <button style={styles.hudBtn} onClick={() => setShowControls(!showControls)}>
            ? CONTROLS
          </button>
        </div>
      </div>

      {/* Controls overlay */}
      {showControls && (
        <div style={styles.controlsOverlay} onClick={() => setShowControls(false)}>
          <div style={styles.controlsCard} onClick={e => e.stopPropagation()}>
            <p style={styles.controlsTitle}>AIRCRAFT CONTROLS</p>

            <p style={styles.controlsSection}>ORBIT MODE</p>
            <table style={styles.controlsTable}>
              <tbody>
                {[
                  ['Drag', 'Rotate view'],
                  ['Scroll', 'Zoom in / out'],
                ].map(([k,d]) => (
                  <tr key={k}>
                    <td style={styles.keyCell}><kbd style={styles.kbd}>{k}</kbd></td>
                    <td style={styles.descCell}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{...styles.controlsSection, marginTop: '1rem'}}>FLY MODE</p>
            <table style={styles.controlsTable}>
              <tbody>
                {[
                  ['W / ↑', 'Pitch up (climb)'],
                  ['S / ↓', 'Pitch down (dive)'],
                  ['A / ←', 'Bank & turn left'],
                  ['D / →', 'Bank & turn right'],
                  ['E', 'Throttle up'],
                  ['Q', 'Throttle down'],
                ].map(([k,d]) => (
                  <tr key={k}>
                    <td style={styles.keyCell}><kbd style={styles.kbd}>{k}</kbd></td>
                    <td style={styles.descCell}>{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              style={{...styles.hudBtn, marginTop: '1.25rem', width: '100%'}}
              onClick={() => setShowControls(false)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Flight telemetry HUD */}
      {flyMode && (
        <div style={styles.telemetry}>
          <div style={styles.telRow}>
            <span style={styles.telLabel}>✈ POS</span>
            <span style={styles.telVal}>
              {cameraPosition.x.toFixed(0)}, {cameraPosition.y.toFixed(0)}, {cameraPosition.z.toFixed(0)}
            </span>
          </div>
          <div style={styles.telRow}>
            <span style={styles.telLabel}>ALT</span>
            <span style={styles.telVal}>{Math.max(0, cameraPosition.y).toFixed(0)} m</span>
          </div>
        </div>
      )}

      {/* Side panel */}
      <div style={styles.sidePanel}>
        <div style={styles.panelTabs}>
          <button
            style={{...styles.tab, ...(sidePanel === 'guide' ? styles.tabActive : {})}}
            onClick={() => setSidePanel('guide')}
          >GUIDE</button>
          <button
            style={{...styles.tab, ...(sidePanel === 'info' ? styles.tabActive : {})}}
            onClick={() => setSidePanel('info')}
          >INFO</button>
        </div>
        <div style={styles.panelContent}>
          {sidePanel === 'guide' ? <GuidePanel /> : <DestinationInfo />}
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    width: '100%', height: '100%',
    position: 'relative', overflow: 'hidden',
    background: '#0d0b08',
  },
  canvas: {
    position: 'absolute', inset: 0, right: 320,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 320,
    height: 52,
    // background: 'linear-gradient(to bottom, rgba(13,11,8,0.95), transparent)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 1.25rem',
    zIndex: 10,
    borderBottom: '1px solid rgba(200,144,42,0.08)',
  },
  backBtn: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.2em', color: '#c8b090',
    background: 'transparent', border: 'none',
    cursor: 'pointer', padding: '0.25rem 0',
  },
  destName: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  destLabel: {
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.25em', color: '#c8b090',fontWeight: 400,
  },
  destTitle: {
    fontFamily: 'Cinzel, serif', fontSize: '0.85rem',
    letterSpacing: '0.1em', color: '#c8b090', fontWeight: 600,
  },
  topRight: { display: 'flex', gap: '0.5rem' },
  hudBtn: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.12em', color: '#c8b090',
    background: 'rgba(13,11,8,0.7)',
    border: '1px solid rgba(200,144,42,0.2)',
    borderRadius: '1px', padding: '0.35rem 0.75rem',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  telemetry: {
    position: 'absolute', bottom: '1rem', left: '1rem',
    fontFamily: 'Cinzel, serif', fontSize: '0.55rem',
    letterSpacing: '0.15em',
    background: 'rgba(13,11,8,0.8)',
    border: '1px solid rgba(200,144,42,0.15)',
    borderRadius: '1px', padding: '0.5rem 0.85rem',
    display: 'flex', flexDirection: 'column', gap: '0.3rem',
    zIndex: 10,
  },
  telRow: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
  telLabel: { color: '#c8902a', minWidth: 30 },
  telVal: { color: '#c8b090' },
  sidePanel: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 320,
    background: 'rgba(10,8,6,0.96)',
    borderLeft: '1px solid rgba(200,144,42,0.15)',
    display: 'flex', flexDirection: 'column',
    zIndex: 10,
  },
  panelTabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(200,144,42,0.12)',
    flexShrink: 0,
  },
  tab: {
    flex: 1, fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.2em', padding: '0.85rem',
    background: 'transparent', border: 'none',
    color: '#4a3a28', cursor: 'pointer', transition: 'all 0.2s',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: '#c8902a', borderBottomColor: '#c8902a',
    background: 'rgba(200,144,42,0.04)',
  },
  panelContent: { flex: 1, overflowY: 'auto' },
  controlsOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.6)', zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  controlsCard: {
    background: '#0d0b08',
    border: '1px solid rgba(200,144,42,0.3)',
    borderRadius: '2px', padding: '2rem', minWidth: 320,
    boxShadow: '0 32px 64px rgba(0,0,0,0.8)',
  },
  controlsTitle: {
    fontFamily: 'Cinzel, serif', fontSize: '0.8rem',
    letterSpacing: '0.25em', color: '#c8902a', marginBottom: '1rem',
  },
  controlsSection: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.2em', color: '#6a5038', marginBottom: '0.5rem',
  },
  controlsTable: { width: '100%', borderCollapse: 'collapse' },
  keyCell: { padding: '0.3rem 0.75rem 0.3rem 0', width: 90 },
  descCell: {
    fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem',
    color: '#8a7868', padding: '0.3rem 0',
  },
  kbd: {
    fontFamily: 'Cinzel, serif', fontSize: '0.6rem',
    letterSpacing: '0.1em', color: '#f5ede0',
    background: 'rgba(200,144,42,0.12)',
    border: '1px solid rgba(200,144,42,0.3)',
    borderRadius: '2px', padding: '0.2rem 0.5rem',
  },
}