import os
from pathlib import Path
from typing import List, Optional

from supabase import create_client


DEFAULT_BUCKET = "analytics-data"
DEFAULT_FILES = [
    "visits.csv",
    "queue_events.csv",
    "staff_service_log.csv",
    "services.csv",
    "counters.csv",
]


def _env(name: str, default: Optional[str] = None) -> str:
    v = os.environ.get(name, default)
    if v is None or v == "":
        raise ValueError(f"Missing required env var: {name}")
    return v


def sync_org_exports(
    organization_id: str,
    bucket: str = DEFAULT_BUCKET,
    files: List[str] = DEFAULT_FILES,
    local_root: str = "data_exports",
    remote_root: str = "analytics",
) -> Path:
    """
    Download CSV exports for an organization from Supabase Storage into:
      {local_root}/{organization_id}/<file>.csv

    Returns the local org folder Path.
    """
    supabase_url = _env("SUPABASE_URL")
    service_key = _env("SUPABASE_SERVICE_ROLE_KEY")  # server-only
    supabase = create_client(supabase_url, service_key)

    org_dir = Path(local_root) / organization_id
    org_dir.mkdir(parents=True, exist_ok=True)

    for fname in files:
        remote_path = f"{remote_root}/{organization_id}/data_exports/{fname}"
        try:
            data = supabase.storage.from_(bucket).download(remote_path)
        except Exception as e:
            raise RuntimeError(f"Failed to download {remote_path} from bucket {bucket}: {e}")

        (org_dir / fname).write_bytes(data)

    return org_dir
