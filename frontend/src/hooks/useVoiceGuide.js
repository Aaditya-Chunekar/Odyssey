import { useRef, useCallback } from 'react'
import { useStore } from '../store'

export function useVoiceGuide() {
  const ws = useRef(null)
  const { setGuideConnected, addGuideMessage, setIsSpeaking, destData, language, cameraPosition } = useStore()

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    ws.current = new WebSocket(`${proto}://${window.location.host}/ws/voice-guide`)

    ws.current.onopen = () => {
      setGuideConnected(true)
      // Send context
      ws.current.send(JSON.stringify({
        type: 'context',
        destination: destData?.name || 'unknown',
        language,
        position: cameraPosition,
      }))
    }

    ws.current.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'ready') {
        addGuideMessage({ role: 'system', text: msg.message })
      } else if (msg.type === 'answer') {
        addGuideMessage({ role: 'guide', text: msg.text })
        speakText(msg.text, language)
      } else if (msg.type === 'error') {
        addGuideMessage({ role: 'error', text: msg.message })
      }
    }

    ws.current.onclose = () => setGuideConnected(false)
    ws.current.onerror = () => setGuideConnected(false)
  }, [destData, language, cameraPosition])

  const disconnect = useCallback(() => {
    ws.current?.close()
    setGuideConnected(false)
  }, [])

  const sendQuestion = useCallback((text) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return
    addGuideMessage({ role: 'user', text })
    ws.current.send(JSON.stringify({
      type: 'question',
      text,
      position: cameraPosition,
    }))
  }, [cameraPosition])

  const speakText = (text, lang) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95
    utt.pitch = 1.0

    // Try to match a voice for the language
    const voices = window.speechSynthesis.getVoices()
    const langMap = {
      'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Italian': 'it',
      'Portuguese': 'pt', 'Japanese': 'ja', 'Chinese (Mandarin)': 'zh',
      'Korean': 'ko', 'Arabic': 'ar', 'Hindi': 'hi', 'Russian': 'ru',
      'Dutch': 'nl', 'Swedish': 'sv', 'Thai': 'th', 'Vietnamese': 'vi',
      'Turkish': 'tr', 'Polish': 'pl',
    }
    const code = langMap[lang]
    if (code) {
      const match = voices.find(v => v.lang.startsWith(code))
      if (match) utt.voice = match
    }

    setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
  }

  return { connect, disconnect, sendQuestion, speakText }
}
