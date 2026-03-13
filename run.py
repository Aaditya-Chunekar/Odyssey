#!/usr/bin/env python3
"""Odyssey — run.py entry point."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["./backend"],
        app_dir="./backend",
    )
