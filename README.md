# 🌍 Odyssey — Multilingual 3D Travel Guide

> Type any destination → fly over real 3D terrain → hear it narrated in any language.

---

## ✨ Features

| Feature | How it works |
|---|---|
| 🔍 **Destination search** | Type any place → Gemini 2.0 Flash resolves bounds + metadata |
| 🏔️ **Real elevation** | AWS Terrain Tiles (Terrarium encoding) → decoded to 3D mesh |
| 🎨 **Hypsometric coloring** | Auto-colored by elevation: valleys → peaks → snow |
| 🎮 **Fly mode** | WASD + Q/E to soar freely over the terrain |
| 🌐 **20 languages** | Guide narration in Spanish, Japanese, Arabic, Hindi, and more |
| 🎤 **Live voice guide** | WebSocket chat — ask questions, get spoken answers via TTS |
| 🗣️ **Voice input** | Speak your questions with Web Speech API |
| 💾 **Smart cache** | Terrain + destination data cached on disk — revisit instantly, zero extra API calls |

---

## 🚀 Quick Start

### 1. Clone & set up

```bash
git clone https://github.com/Aaditya-Chunekar/odyssey
cd odyssey

cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
# or with uv:
# uv pip install -r requirements.txt

cd ..
python run.py
# → http://localhost:8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

Open **http://localhost:3000** and start exploring.

---

## 🏗️ Project Structure

```
odyssey/
├── backend/
│   ├── main.py          # FastAPI routes (resolve, terrain, narration, WS voice)
│   └── terrain.py       # AWS Terrain Tile fetching + Terrarium decoder
├── frontend/
│   └── src/
│       ├── App.jsx              # Phase router
│       ├── store.js             # Zustand global state
│       ├── index.css            # Global styles (Cinzel + Crimson Pro aesthetic)
│       ├── components/
│       │   ├── SearchScreen.jsx   # Landing + destination search
│       │   ├── LoadingScreen.jsx  # Animated loading with step progress
│       │   ├── TerrainScreen.jsx  # Main 3D viewer + HUD
│       │   ├── TerrainViewer.jsx  # Three.js R3F canvas + fly controls
│       │   ├── GuidePanel.jsx     # Narration + live voice chat
│       │   └── DestinationInfo.jsx # Metadata sidebar
│       ├── hooks/
│       │   └── useVoiceGuide.js  # WebSocket + TTS hook
│       └── utils/
│           └── api.js            # Axios API helpers
├── cache/               # Auto-created — terrain + destination cache files
├── run.py               # Entry point
├── .env.example
└── README.md
```

---

## 🔑 Environment Variables

```env
GEMINI_API_KEY=your_key_here
```

Get a key at [aistudio.google.com](https://aistudio.google.com).

---

## 🎮 Controls

| Mode | Key | Action |
|---|---|---|
| Orbit | Drag | Rotate view |
| Orbit | Scroll | Zoom |
| Fly | W / ↑ | Fly forward |
| Fly | S / ↓ | Fly backward |
| Fly | A / ↓ | Strafe left |
| Fly | D / → | Strafe right |
| Fly | E | Ascend |
| Fly | Q | Descend |

---

## 🧠 AI Flow

```
1. User types "Patagonia, Argentina"
   └→ Gemini 2.0 Flash → resolves bounds, country, description, fun facts
       └→ Cached to disk (cache/<md5>.json)

2. Terrain fetch
   └→ Bounds → tile coords → AWS S3 Terrarium PNGs
       └→ Decode RGB → elevation grid → R3F PlaneGeometry
           └→ Cached to disk

3. Narration
   └→ Gemini 2.0 Flash → poetic multilingual narration
       └→ Web Speech API TTS playback

4. Live guide (WebSocket)
   └→ Chat messages → Gemini maintains conversation history
       └→ Answers streamed back → spoken aloud
```

---

## 🌐 Languages Supported

English, Spanish, French, German, Italian, Portuguese, Japanese, Chinese (Mandarin), Korean, Arabic, Hindi, Russian, Dutch, Swedish, Thai, Vietnamese, Turkish, Polish, Czech, Greek

---

## 🏛️ Tech Stack

- **Frontend**: React 18 + Vite + Three.js via @react-three/fiber + Zustand
- **Backend**: FastAPI + Python
- **AI**: Google Gemini 2.0 Flash (destination resolution + narration + chat)
- **Elevation**: AWS Terrain Tiles (Terrarium RGB encoding)
- **TTS**: Web Speech API (browser-native, no extra cost)
- **Voice input**: Web Speech Recognition API

---

## 💡 Notable Design Decisions

- **Cache-first** — terrain + destination metadata is saved to `./cache/`. The same place is never re-fetched unless you delete the cache.
- **Browser TTS** — we use the built-in Web Speech API rather than a paid TTS provider, keeping costs at zero beyond Gemini.
- **WebSocket guide** — the guide maintains chat history per session so context is preserved across questions.
