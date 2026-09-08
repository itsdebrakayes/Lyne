"""
dbio.py — One place to open a DB connection and read/write predictive_results.

Every model script needs the same connection and the same upsert-into-
predictive_results shape. Keeping it here stops each script from re-declaring
credentials and drifting on the insert contract.
"""
from __future__ import annotations

import json
import os
import uuid

import pymysql


def _ssl_options():
    """TLS to the database, matching apps/backend/src/db/pool.js.

    Local Docker reaches MySQL over the compose network and needs no TLS, so
    MYSQL_SSL stays unset. A managed database sets require_secure_transport=ON
    and refuses a plaintext connection outright — so the worker has to speak the
    same TLS as the API, or it silently stops producing predictions two hours
    after a deploy that looked successful.

        MYSQL_SSL=true       verify the server against MYSQL_SSL_CA (correct)
        MYSQL_SSL=no-verify  encrypt without verifying (connectivity tests only)
        unset / false        no TLS — local Docker only
    """
    mode = (os.getenv("MYSQL_SSL") or "").strip().lower()
    if mode in ("", "false", "disabled", "0"):
        return None

    ca_path = (os.getenv("MYSQL_SSL_CA") or "").strip()
    if ca_path:
        return {"ca": ca_path}
    if mode == "no-verify":
        return {"check_hostname": False, "verify_mode": None}

    raise RuntimeError(
        "MYSQL_SSL is on but MYSQL_SSL_CA is not set. Point it at the provider's "
        "CA certificate file, or set MYSQL_SSL=no-verify to accept an unverified "
        "connection."
    )


def connect():
    ssl = _ssl_options()
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3308")),
        user=os.getenv("MYSQL_USER", "lyne"),
        password=os.getenv("MYSQL_PASSWORD", "lyne_secret"),
        database=os.getenv("MYSQL_DATABASE", "lyne"),
        cursorclass=pymysql.cursors.DictCursor,
        **({"ssl": ssl} if ssl else {}),
    )


def upsert_insights(conn, insights, generated_at, stale_after, model_version, records_processed=0):
    """Replace-then-insert each (business_id, insight_type) row. Each insight is
    {business_id, insight_type, insight_data, [branch_id], [service_id]}."""
    with conn.cursor() as cursor:
        for insight in insights:
            cursor.execute(
                "DELETE FROM predictive_results WHERE business_id = %s AND insight_type = %s",
                (insight["business_id"], insight["insight_type"]),
            )
            cursor.execute(
                """INSERT INTO predictive_results
                     (id, business_id, branch_id, service_id, insight_type, insight_data,
                      model_version, records_processed, stale_after, generated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    str(uuid.uuid4()),
                    insight["business_id"],
                    insight.get("branch_id"),
                    insight.get("service_id"),
                    insight["insight_type"],
                    json.dumps(insight["insight_data"]),
                    model_version,
                    insight.get("records_processed", records_processed),
                    stale_after.strftime("%Y-%m-%d %H:%M:%S"),
                    generated_at.strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
    conn.commit()
