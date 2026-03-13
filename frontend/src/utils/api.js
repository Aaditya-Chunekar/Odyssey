import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export async function resolveDestination(destination, language) {
  const { data } = await api.post('/resolve-destination', { destination, language })
  return data
}

export async function fetchTerrain(destination, bounds) {
  const { data } = await api.post('/terrain', { destination, bounds })
  return data
}

export async function fetchNarration(destination, bounds, language, position) {
  const { data } = await api.post('/narration', { destination, bounds, language, position })
  return data
}

export async function getLanguages() {
  const { data } = await api.get('/languages')
  return data.languages
}
