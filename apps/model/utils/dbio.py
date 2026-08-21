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


def connect():
    return pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "3308")),
        user=os.getenv("MYSQL_USER", "lyne"),
        password=os.getenv("MYSQL_PASSWORD", "lyne_secret"),
        database=os.getenv("MYSQL_DATABASE", "qme_now"),
        cursorclass=pymysql.cursors.DictCursor,
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
