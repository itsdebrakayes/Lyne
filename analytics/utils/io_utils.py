"""
I/O utilities for notebook state management and file operations.
"""
import os
import json
import hashlib
from pathlib import Path
from typing import Dict, Tuple, List, Any


def file_fingerprint(path: str) -> Dict[str, Any]:
    """Generate a fingerprint for a file based on mtime and size."""
    p = Path(path)
    if not p.exists():
        return {"exists": False}
    stat = p.stat()
    return {
        "exists": True,
        "mtime": stat.st_mtime,
        "size": stat.st_size,
    }


def file_hash(path: str) -> str:
    """Generate MD5 hash of file contents."""
    p = Path(path)
    if not p.exists():
        return ""
    return hashlib.md5(p.read_bytes()).hexdigest()


def load_state(state_path: str) -> Dict[str, Any]:
    """Load notebook state from JSON file."""
    p = Path(state_path)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def save_state(state_path: str, state: Dict[str, Any]) -> None:
    """Save notebook state to JSON file."""
    Path(state_path).parent.mkdir(parents=True, exist_ok=True)
    Path(state_path).write_text(json.dumps(state, indent=2), encoding="utf-8")


def should_run(input_files: List[str], state_path: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Check if notebook should run based on input file changes.
    
    Returns:
        Tuple of (should_run: bool, new_state: dict)
    """
    prev = load_state(state_path)
    current = {f: file_fingerprint(f) for f in input_files}
    run = (prev.get("fingerprints") != current)
    return run, {"fingerprints": current, "last_check": str(Path(state_path).stat().st_mtime) if Path(state_path).exists() else None}


def write_output_json(output_path: str, data: Dict[str, Any]) -> None:
    """Write output JSON with proper formatting."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def read_csv_to_df(csv_path: str):
    """Read CSV file to pandas DataFrame with error handling."""
    import pandas as pd
    try:
        return pd.read_csv(csv_path, parse_dates=True)
    except Exception as e:
        print(f"Error reading {csv_path}: {e}")
        return None
