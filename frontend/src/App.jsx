import React from 'react'
import { useStore } from './store'
import SearchScreen from './components/SearchScreen'
import LoadingScreen from './components/LoadingScreen'
import TerrainScreen from './components/TerrainScreen'

export default function App() {
  const { phase } = useStore()

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {phase === 'search'  && <SearchScreen />}
      {phase === 'loading' && <LoadingScreen />}
      {phase === 'terrain' && <TerrainScreen />}
    </div>
  )
}
