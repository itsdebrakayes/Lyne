"""
I/O utilities for notebook state management and file operations.
"""
import json
from pathlib import Path
from typing import Dict, Tuple, List, Any, Optional
from datetime import datetime, timezone

import pandas as pd


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def file_fingerprint(path: str) -> Dict[str, Any]:
    """Fingerprint for a file based on mtime and size (fast, good enough for CSV exports)."""
    p = Path(path)
    if not p.exists():
        return {"exists": False}
    stat = p.stat()
    return {"exists": True, "mtime": stat.st_mtime, "size": stat.st_size}


def load_state(state_path: str) -> Dict[str, Any]:
    """Load notebook state from JSON file."""
    p = Path(state_path)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


def save_state(state_path: str, state: Dict[str, Any]) -> None:
    """Save notebook state to JSON file."""
    p = Path(state_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=2), encoding="utf-8")


def should_run(input_files: List[str], state_path: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Check if notebook should run based on input file changes.

    Returns:
        (should_run, new_state)
    """
    prev = load_state(state_path)
    current = {f: file_fingerprint(f) for f in input_files}
    run = (prev.get("fingerprints") != current)

    new_state = {
        "fingerprints": current,
        "last_run_utc": prev.get("last_run_utc")  # updated after successful run
    }
    return run, new_state


def mark_state_ran(new_state: Dict[str, Any]) -> Dict[str, Any]:
    """Mark state as successfully executed."""
    new_state = dict(new_state)
    new_state["last_run_utc"] = utc_now_iso()
    return new_state


def write_output_json(output_path: str, data: Dict[str, Any]) -> None:
    """Write output JSON with proper formatting."""
    p = Path(output_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def read_csv_to_df(csv_path: str, date_cols: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Read CSV into a DataFrame, parsing specified datetime columns.
    """
    df = pd.read_csv(csv_path)
    if date_cols:
        for c in date_cols:
            if c in df.columns:
                df[c] = pd.to_datetime(df[c], utc=True, errors="coerce")
                if df[c].isna().any():
                    bad = df[df[c].isna()].head(3)
                    raise ValueError(f"Invalid datetime in {csv_path} column '{c}'. Examples:\n{bad}")
    return df
