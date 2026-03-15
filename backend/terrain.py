"""
terrain.py — AWS Terrain Tiles (Terrarium encoding) fetcher & processor.
Tiles use Terrarium RGB encoding: elevation = (R * 256 + G + B/256) - 32768
"""

import math
import asyncio
import httpx
from io import BytesIO
from pathlib import Path
from PIL import Image
import numpy as np
import rasterio
from rasterio.transform import from_bounds


ARTIFACTS_DIR = Path("./cache/artifacts")
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def lat_lon_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    """Convert lat/lon to tile x/y at given zoom level."""
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def tile_bounds(x: int, y: int, zoom: int) -> dict:
    """Get lat/lon bounds of a tile."""
    n = 2 ** zoom
    lon_west = x / n * 360.0 - 180.0
    lon_east = (x + 1) / n * 360.0 - 180.0
    lat_north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return {"north": lat_north, "south": lat_south, "east": lon_east, "west": lon_west}


def decode_terrarium(r: int, g: int, b: int) -> float:
    """Decode Terrarium RGB to elevation in meters."""
    return (r * 256 + g + b / 256) - 32768


async def fetch_tile(client: httpx.AsyncClient, x: int, y: int, zoom: int, tile_out_dir: Path | None = None) -> Image.Image | None:
    """Fetch a single terrain tile from AWS."""
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png"
    try:
        resp = await client.get(url, timeout=15.0)
        if resp.status_code == 200:
            if tile_out_dir:
                tile_out_dir.mkdir(parents=True, exist_ok=True)
                (tile_out_dir / f"{zoom}_{x}_{y}.png").write_bytes(resp.content)
            return Image.open(BytesIO(resp.content)).convert("RGB")
    except Exception:
        pass
    return None


def bounds_to_tiles(bounds: dict, zoom: int = 10) -> list[tuple[int, int]]:
    """Get all tile (x,y) coords covering the bounds at given zoom."""
    x_min, y_min = lat_lon_to_tile(bounds["north"], bounds["west"], zoom)
    x_max, y_max = lat_lon_to_tile(bounds["south"], bounds["east"], zoom)
    tiles = []
    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            tiles.append((x, y))
    return tiles


async def fetch_terrain_tiles(
    bounds: dict,
    zoom: int = 10,
    target_size: int = 128,
    artifact_id: str | None = None,
    save_png: bool = False,
    save_geotiff: bool = False,
) -> dict:
    """
    Fetch terrain tiles for bounds, stitch them, sample to target_size grid.
    Returns dict with elevations (flat list), width, height, min/max elev.
    """
    tiles = bounds_to_tiles(bounds, zoom)

    # Cap tile count to avoid huge requests
    if len(tiles) > 25:
        zoom = 9
        tiles = bounds_to_tiles(bounds, zoom)

    x_min = min(t[0] for t in tiles)
    x_max = max(t[0] for t in tiles)
    y_min = min(t[1] for t in tiles)
    y_max = max(t[1] for t in tiles)

    cols = x_max - x_min + 1
    rows = y_max - y_min + 1
    tile_size = 256  # terrarium tiles are 256x256

    stitched = Image.new("RGB", (cols * tile_size, rows * tile_size), (1, 0, 0))  # sea level default
    artifact_dir = ARTIFACTS_DIR / artifact_id if artifact_id else None
    raw_tiles_dir = artifact_dir / "tiles" if (artifact_dir and save_png) else None

    async with httpx.AsyncClient() as client:
        tasks = [(x, y, fetch_tile(client, x, y, zoom, raw_tiles_dir)) for (x, y) in tiles]
        results = await asyncio.gather(*[t[2] for t in tasks])

        for (x, y, _), img in zip(tasks, results):
            if img:
                px = (x - x_min) * tile_size
                py = (y - y_min) * tile_size
                stitched.paste(img, (px, py))

    if artifact_dir and save_png:
        artifact_dir.mkdir(parents=True, exist_ok=True)
        stitched.save(artifact_dir / "stitched.png")

    # Resample to target_size
    resampled = stitched.resize((target_size, target_size), Image.LANCZOS)
    if artifact_dir and save_png:
        resampled.save(artifact_dir / "resampled.png")
    pixels = resampled.load()

    elevations = []
    min_elev = float("inf")
    max_elev = float("-inf")

    for row in range(target_size):
        for col in range(target_size):
            r, g, b = pixels[col, row]
            elev = decode_terrarium(r, g, b)
            # Clamp sea-level noise
            elev = max(elev, 0)
            elevations.append(round(elev, 1))
            if elev < min_elev:
                min_elev = elev
            if elev > max_elev:
                max_elev = elev

    if artifact_dir and save_geotiff:
        arr = np.array(elevations, dtype=np.float32).reshape((target_size, target_size))
        transform = from_bounds(
            bounds["west"],
            bounds["south"],
            bounds["east"],
            bounds["north"],
            target_size,
            target_size,
        )
        with rasterio.open(
            artifact_dir / "terrain.tif",
            "w",
            driver="GTiff",
            height=target_size,
            width=target_size,
            count=1,
            dtype="float32",
            crs="EPSG:4326",
            transform=transform,
        ) as dst:
            dst.write(arr, 1)

    return {
        "elevations": elevations,
        "width": target_size,
        "height": target_size,
        "min_elev": min_elev,
        "max_elev": max_elev,
    }
