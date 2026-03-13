import os
import json
import math
import asyncio
import hashlib
import httpx
from pathlib import Path
from typing import Optional
import google.generativeai as genai
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from terrain import fetch_terrain_tiles, bounds_to_tiles

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Odyssey API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache directory so we don't re-fetch terrain for same location
CACHE_DIR = Path("./cache")
CACHE_DIR.mkdir(exist_ok=True)


# ─── Models ───────────────────────────────────────────────────────────────────

class DestinationRequest(BaseModel):
    destination: str
    language: str = "English"

class TerrainRequest(BaseModel):
    destination: str
    bounds: dict  # {north, south, east, west}

class NarrationRequest(BaseModel):
    destination: str
    bounds: dict
    language: str = "English"
    position: Optional[dict] = None  # {x, y, z} camera position


# ─── Helpers ──────────────────────────────────────────────────────────────────

def cache_key(destination: str) -> str:
    return hashlib.md5(destination.lower().strip().encode()).hexdigest()[:12]


def load_cached(key: str, suffix: str):
    p = CACHE_DIR / f"{key}_{suffix}.json"
    if p.exists():
        return json.loads(p.read_text())
    return None


def save_cached(key: str, suffix: str, data):
    p = CACHE_DIR / f"{key}_{suffix}.json"
    p.write_text(json.dumps(data))


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "gemini_configured": bool(GEMINI_API_KEY)}


@app.post("/api/resolve-destination")
async def resolve_destination(req: DestinationRequest):
    """Use Gemini to resolve a destination name to geographic bounds + metadata."""
    key = cache_key(req.destination)
    cached = load_cached(key, "destination")
    if cached:
        return {**cached, "cached": True}

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""You are a geographic data assistant. For the destination "{req.destination}", return ONLY a JSON object (no markdown, no explanation) with these exact fields:

{{
  "name": "Full official name of the destination",
  "country": "Country name",
  "description": "2-sentence evocative description for a traveler",
  "fun_facts": ["fact1", "fact2", "fact3"],
  "best_languages": ["primary language", "secondary if relevant"],
  "bounds": {{
    "north": <latitude float>,
    "south": <latitude float>,
    "east": <longitude float>,
    "west": <longitude float>
  }}
}}

Bounds should cover the main area of interest at roughly 30-80km scale (zoom 9-11 DEM resolution). Return ONLY the JSON."""

    response = model.generate_content(prompt)
    text = response.text.strip()
    # Strip any accidental markdown fences
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    data = json.loads(text)
    save_cached(key, "destination", data)
    return {**data, "cached": False}


@app.post("/api/terrain")
async def get_terrain(req: TerrainRequest):
    """Fetch elevation data from AWS terrain tiles and return as grid."""
    key = cache_key(req.destination)
    cached = load_cached(key, "terrain")
    if cached:
        return {**cached, "cached": True}

    bounds = req.bounds
    save_png = os.getenv("SAVE_TERRAIN_PNG", "0") == "1"
    save_geotiff = os.getenv("SAVE_TERRAIN_GEOTIFF", "0") == "1"

    grid = await fetch_terrain_tiles(
        bounds,
        artifact_id=key,
        save_png=save_png,
        save_geotiff=save_geotiff,
    )

    result = {
        "grid": grid["elevations"],
        "width": grid["width"],
        "height": grid["height"],
        "min_elev": grid["min_elev"],
        "max_elev": grid["max_elev"],
        "bounds": bounds,
    }
    save_cached(key, "terrain", result)
    return {**result, "cached": False}


@app.post("/api/narration")
async def get_narration(req: NarrationRequest):
    """Generate a rich multilingual narration for the destination."""
    model = genai.GenerativeModel("gemini-2.5-flash")

    pos_info = ""
    if req.position:
        pos_info = f"The traveler is currently flying over coordinates approximately ({req.position.get('lat', '?'):.4f}°N, {req.position.get('lon', '?'):.4f}°E) at altitude {req.position.get('alt', '?'):.0f}m."

    prompt = f"""You are an expert, passionate multilingual travel guide narrating a live 3D flyover of {req.destination}.
{pos_info}

Speak in {req.language}. Be vivid, poetic, and informative — like a knowledgeable local friend flying with the traveler.
Cover: notable geography visible below, historical significance, cultural gems, travel tips, local cuisine, hidden stories.

Keep the narration to 3-4 sentences — punchy and immersive. Start speaking directly, no greetings."""

    response = model.generate_content(prompt)
    return {"narration": response.text.strip(), "language": req.language}


@app.websocket("/ws/voice-guide")
async def voice_guide_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time conversational voice guide.
    Client sends JSON messages: {type: "context", destination: ..., language: ..., position: ...}
    or {type: "question", text: "..."}
    Server responds with {type: "answer", text: "..."}
    """
    await websocket.accept()
    
    context = {}
    model = genai.GenerativeModel("gemini-2.5-flash")
    chat = model.start_chat(history=[])

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg["type"] == "context":
                context = msg
                system = f"""You are Odyssey — a warm, knowledgeable, multilingual travel guide AI.
The traveler is doing a 3D flyover of {context.get('destination', 'an unknown destination')}.
Speak in {context.get('language', 'English')}. Be concise (2-3 sentences), vivid, and engaging.
If the traveler asks in a different language, detect it and respond in that language.
Current flight position: {context.get('position', 'unknown')}."""
                chat = model.start_chat(history=[
                    {"role": "user", "parts": [system]},
                    {"role": "model", "parts": ["Understood! I'm ready to guide the journey. Ask me anything about what you see below."]}
                ])
                await websocket.send_text(json.dumps({
                    "type": "ready",
                    "message": f"Guide ready for {context.get('destination', 'your destination')}!"
                }))

            elif msg["type"] == "question":
                question = msg.get("text", "")
                if not question:
                    continue
                
                # Update position context if provided
                if "position" in msg:
                    context["position"] = msg["position"]

                response = chat.send_message(question)
                await websocket.send_text(json.dumps({
                    "type": "answer",
                    "text": response.text.strip()
                }))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass


@app.get("/api/languages")
async def get_languages():
    return {"languages": [
        "English", "Spanish", "French", "German", "Italian", "Portuguese",
        "Japanese", "Chinese (Mandarin)", "Korean", "Arabic", "Hindi",
        "Russian", "Dutch", "Swedish", "Thai", "Vietnamese", "Turkish",
        "Polish", "Czech", "Greek"
    ]}
