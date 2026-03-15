import os
import re
import json
import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
LINGO_API_KEY   = os.getenv("LINGO_API_KEY", "")
LINGO_ENGINE_ID = os.getenv("LINGO_ENGINE_ID", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("terravoice")

# ─── Gemini setup ─────────────────────────────────────────────────────────────

try:
    from google import genai as google_genai
    _client = google_genai.Client(api_key=GEMINI_API_KEY)
    def _gemini(prompt: str) -> str:
        resp = _client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        return resp.text.strip()
    SDK = "new"
except Exception:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    def _gemini(prompt: str) -> str:
        return genai.GenerativeModel("gemini-2.5-flash").generate_content(prompt).text.strip()
    SDK = "old"

# ─── Lingo.dev translation ────────────────────────────────────────────────────

LINGO_URL = "https://api.lingo.dev/process/localize"

LANG_TO_LOCALE: dict[str, str] = {
    "English": "en", "Spanish": "es", "French": "fr", "German": "de",
    "Italian": "it", "Portuguese": "pt", "Japanese": "ja",
    "Chinese (Mandarin)": "zh", "Korean": "ko", "Arabic": "ar",
    "Hindi": "hi", "Russian": "ru", "Dutch": "nl", "Swedish": "sv",
    "Thai": "th", "Vietnamese": "vi", "Turkish": "tr",
    "Polish": "pl", "Czech": "cs", "Greek": "el",
}

async def lingo_translate(data: dict[str, str], target_language: str) -> tuple[dict[str, str], str]:
    """
    Translate key-value string dict via lingo.dev.
    Returns (translated_dict, source) where source is 'lingo' or 'gemini_fallback'.
    Falls back to Gemini if lingo is unavailable or limit exceeded.
    """
    target_locale = LANG_TO_LOCALE.get(target_language, "en")

    # No translation needed for English
    if target_locale == "en":
        return data, "passthrough"

    if not LINGO_API_KEY or not LINGO_ENGINE_ID:
        log.warning("lingo | no api key or engine id — using gemini fallback")
        return await _gemini_translate_dict(data, target_language), "gemini_fallback"

    log.info("lingo | translating %d key(s) → %s (engine: %s)",
             len(data), target_locale, LINGO_ENGINE_ID)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                LINGO_URL,
                headers={"X-API-Key": LINGO_API_KEY, "Content-Type": "application/json"},
                json={"engineId": LINGO_ENGINE_ID, "sourceLocale": "en",
                      "targetLocale": target_locale, "data": data},
            )

        if resp.status_code == 429:
            log.warning("lingo | rate limit hit (429) — falling back to gemini")
            return await _gemini_translate_dict(data, target_language), "gemini_fallback"

        if resp.status_code != 200:
            log.warning("lingo | unexpected status %d — falling back to gemini", resp.status_code)
            return await _gemini_translate_dict(data, target_language), "gemini_fallback"

        translated = resp.json().get("data", {})
        log.info("lingo | ✓ translated successfully → %s", target_locale)
        for k, v in translated.items():
            log.info("lingo |   [%s] %s", k, v[:80] + ("…" if len(v) > 80 else ""))
        return translated, "lingo"

    except Exception as e:
        log.warning("lingo | error (%s) — falling back to gemini", e)
        return await _gemini_translate_dict(data, target_language), "gemini_fallback"


async def _gemini_translate_dict(data: dict[str, str], target_language: str) -> dict[str, str]:
    """Gemini fallback: translate each value preserving keys."""
    log.info("gemini_fallback | translating %d key(s) → %s", len(data), target_language)
    result = {}
    combined = "\n".join(f"{k}: {v}" for k, v in data.items())
    prompt = (
        f"Translate the following lines into {target_language}. "
        f"Keep the key prefix (before the colon) exactly as-is. "
        f"Return only the translated lines, same format.\n\n{combined}"
    )
    raw = await asyncio.get_event_loop().run_in_executor(None, _gemini, prompt)
    for line in raw.strip().splitlines():
        if ": " in line:
            k, _, v = line.partition(": ")
            k = k.strip()
            if k in data:
                result[k] = v.strip()
    # fill any missing keys untranslated
    for k, v in data.items():
        if k not in result:
            result[k] = v
    return result

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="TerraVoice API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
# cache saves time if revisiting any previosuly visited destination
CACHE_DIR = Path("./cache")
CACHE_DIR.mkdir(exist_ok=True)

# ─── Models ───────────────────────────────────────────────────────────────────

class DestinationRequest(BaseModel):
    destination: str
    language: str = "English"

class TerrainRequest(BaseModel):
    destination: str
    bounds: dict

class NarrationRequest(BaseModel):
    destination: str
    bounds: dict
    language: str = "English"
    position: Optional[dict] = None

# ─── Helpers ──────────────────────────────────────────────────────────────────
def cache_key(destination: str) -> str:
    return hashlib.md5(destination.lower().strip().encode()).hexdigest()[:12]

def load_cached(key: str, suffix: str):
    p = CACHE_DIR / f"{key}_{suffix}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return None

def save_cached(key: str, suffix: str, data):
    (CACHE_DIR / f"{key}_{suffix}.json").write_text(json.dumps(data))

def strip_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*```$', '', text)
    text = text.strip()
    if not text.startswith('{'):
        start = text.find('{')
        if start != -1:
            text = text[start:]
    return text

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "gemini_sdk": SDK,
        "lingo_configured": bool(LINGO_API_KEY and LINGO_ENGINE_ID),
    }


@app.post("/api/resolve-destination")
async def resolve_destination(req: DestinationRequest):
    """Gemini resolves geo bounds + metadata in English. No translation needed here."""
    key = cache_key(req.destination)
    cached = load_cached(key, "destination")
    if cached:
        return {**cached, "cached": True}

    prompt = f"""You are a geographic data assistant. For the destination "{req.destination}", return ONLY a valid JSON object with no markdown, no explanation. Use exactly these fields:

{{
  "name": "Full official name",
  "country": "Country name",
  "description": "2-sentence evocative traveler description",
  "fun_facts": ["fact1", "fact2", "fact3"],
  "best_languages": ["primary language"],
  "bounds": {{
    "north": 0.0,
    "south": 0.0,
    "east": 0.0,
    "west": 0.0
  }}
}}

Bounds should cover the area at ~30-80km scale. Output raw JSON only."""

    try:
        text = await asyncio.get_event_loop().run_in_executor(None, _gemini, prompt)
        data = json.loads(strip_json(text))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"gemini returned invalid json: {e}")
    except Exception as e:
        raise HTTPException(500, f"gemini error: {e}")

    save_cached(key, "destination", data)
    return {**data, "cached": False}


@app.post("/api/terrain")
async def get_terrain(req: TerrainRequest):
    from terrain import fetch_terrain_tiles
    key = cache_key(req.destination)
    cached = load_cached(key, "terrain")
    if cached:
        return {**cached, "cached": True}

    try:
        grid = await fetch_terrain_tiles(req.bounds)
    except Exception as e:
        raise HTTPException(500, f"terrain fetch error: {e}")

    result = {
        "grid": grid["elevations"], "width": grid["width"], "height": grid["height"],
        "min_elev": grid["min_elev"], "max_elev": grid["max_elev"], "bounds": req.bounds,
    }
    save_cached(key, "terrain", result)
    return {**result, "cached": False}


@app.post("/api/narration")
async def get_narration(req: NarrationRequest):
    """
    1. Generate English narration with Gemini
    2. Translate to target language via lingo.dev (fallback: gemini)
    """
    pos_info = ""
    if req.position:
        pos_info = (f"The traveler is flying at "
                    f"x={req.position.get('x',0):.1f}, "
                    f"y={req.position.get('y',0):.1f}, "
                    f"z={req.position.get('z',0):.1f}.")

    en_prompt = f"""You are TerraVoice, a passionate travel guide narrating a 3D flyover of {req.destination}.
{pos_info}
Write in English. Be vivid, poetic, informative — like a knowledgeable local friend.
Cover geography, history, culture, food, hidden stories.
3-4 sentences, punchy and immersive. No greetings."""

    try:
        en_text = await asyncio.get_event_loop().run_in_executor(None, _gemini, en_prompt)
    except Exception as e:
        raise HTTPException(500, f"gemini error: {e}")

    # Translate if not English
    translated, source = await lingo_translate({"narration": en_text}, req.language)
    final_text = translated.get("narration", en_text)

    log.info("narration | dest=%s lang=%s source=%s", req.destination, req.language, source)
    return {"narration": final_text, "language": req.language, "translation_source": source}


@app.websocket("/ws/voice-guide")
async def voice_guide_ws(websocket: WebSocket):
    """
    1. Gemini answers in English
    2. lingo.dev translates to target language (fallback: gemini)
    """
    await websocket.accept()
    context: dict = {}
    history: list = []

    def _build_system(dest: str, lang: str, pos) -> str:
        return (f"You are TerraVoice — a knowledgeable travel guide. "
                f"The traveler is doing a 3D flyover of {dest}. "
                f"Always respond in clear English. Be concise (2-3 sentences), vivid, engaging. "
                f"Current position: {pos}.")

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg["type"] == "context":
                context = msg
                dest = context.get("destination", "unknown")
                lang = context.get("language", "English")
                pos  = context.get("position", "unknown")

                system_msg = _build_system(dest, lang, pos)

                if SDK == "old":
                    import google.generativeai as genai_old
                    _model = genai_old.GenerativeModel("gemini-2.5-flash")
                    context["_chat"] = _model.start_chat(history=[
                        {"role": "user",  "parts": [system_msg]},
                        {"role": "model", "parts": ["Understood! Ready to guide your journey."]},
                    ])
                else:
                    history = [
                        {"role": "user",  "parts": [{"text": system_msg}]},
                        {"role": "model", "parts": [{"text": "Understood! Ready to guide your journey."}]},
                    ]
                    context["_history"] = history

                await websocket.send_text(json.dumps({
                    "type": "ready",
                    "message": f"guide ready for {dest}",
                }))

            elif msg["type"] == "question":
                question = msg.get("text", "").strip()
                if not question:
                    continue

                lang = context.get("language", "English")

                try:
                    # ── Get English answer from Gemini ────────────────────
                    if SDK == "old":
                        chat = context.get("_chat")
                        def _send():
                            return chat.send_message(question).text.strip()
                        en_answer = await asyncio.get_event_loop().run_in_executor(None, _send)
                    else:
                        history = context.get("_history", [])
                        history.append({"role": "user", "parts": [{"text": question}]})
                        def _new_chat():
                            return _client.models.generate_content(
                                model="gemini-2.5-flash", contents=history
                            ).text.strip()
                        en_answer = await asyncio.get_event_loop().run_in_executor(None, _new_chat)
                        history.append({"role": "model", "parts": [{"text": en_answer}]})
                        if len(history) > 20:
                            history = history[:2] + history[-18:]
                        context["_history"] = history

                    # ── Translate via lingo.dev ───────────────────────────
                    translated, source = await lingo_translate({"answer": en_answer}, lang)
                    final_answer = translated.get("answer", en_answer)

                    log.info("voice | lang=%s source=%s q=%s", lang, source, question[:60])

                    await websocket.send_text(json.dumps({
                        "type": "answer",
                        "text": final_answer,
                        "translation_source": source,
                    }))

                except Exception as e:
                    await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except Exception:
            pass


@app.get("/api/languages")
async def get_languages():
    return {"languages": list(LANG_TO_LOCALE.keys())}