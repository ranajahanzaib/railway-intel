"""DuckDB-backed analytics over locally published Deutsche Bahn Parquet files."""

from __future__ import annotations

import os
from pathlib import Path

import duckdb

DATA_DIR = Path(os.environ.get("RAILWAY_DATA_DIR", "data/processed"))
GEO_FILE = Path(__file__).parent / "stations_geo.json"
GEO_MAP: dict[str, dict] = {}
if GEO_FILE.is_file():
    try:
        import json

        GEO_MAP = json.loads(GEO_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        GEO_MAP = {}


def connection() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(database=":memory:")


def records(cursor: duckdb.DuckDBPyConnection) -> list[dict]:
    names = [column[0] for column in cursor.description]
    return [dict(zip(names, row)) for row in cursor.fetchall()]


def parquet_glob() -> str | None:
    files = sorted(DATA_DIR.glob("**/*.parquet"))
    return str(DATA_DIR / "**" / "*.parquet") if files else None


def summary() -> dict:
    source = parquet_glob()
    if source is None:
        return {
            "available": False,
            "reason": "No processed railway dataset is installed.",
            "coverage": None,
        }
    con = connection()
    try:
        row = con.execute(
            """
            SELECT count(*) AS observations,
                   count(DISTINCT eva) AS stations,
                   min(time) AS start_time, max(time) AS end_time,
                   count(*) FILTER (WHERE delay_in_min IS NOT NULL) AS timed_events,
                   count(*) FILTER (WHERE delay_in_min IS NOT NULL AND delay_in_min <= 5) AS on_time,
                   count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled)) AS canceled,
                   count(*) FILTER (WHERE has_plan_record) AS planned
            FROM read_parquet(?)
        """,
            [source],
        ).fetchone()
        observations, stations, start, end, timed, on_time, canceled, planned = row
        return {
            "available": True,
            "observations": observations,
            "stations": stations,
            "coverage": {"start": str(start), "end": str(end)},
            "timed_events": timed,
            "on_time_pct": round(on_time * 100 / timed, 1) if timed else None,
            "canceled": canceled,
            "planned": planned,
        }
    finally:
        con.close()


def stations(limit: int = 100, search: str = "") -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        items = records(
            con.execute(
                """
            SELECT eva AS id, coalesce(max(station_name), max(xml_station_name)) AS name,
                   count(*) AS events,
                   round(avg(delay_in_min) FILTER (WHERE delay_in_min >= 0), 1) AS mean_delay,
                   round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                     / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 1) AS on_time_pct,
                   count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled)) AS canceled
            FROM read_parquet(?)
            WHERE eva IS NOT NULL AND (? = '' OR lower(coalesce(station_name, xml_station_name, '')) LIKE '%' || lower(?) || '%')
            GROUP BY eva HAVING count(*) >= 20 ORDER BY mean_delay DESC NULLS LAST LIMIT ?
        """,
                [source, search, search, limit],
            )
        )
        for item in items:
            eva = str(item.get("id") or "")
            geo = GEO_MAP.get(eva) or GEO_MAP.get(eva.lstrip("0"))
            item["lat"] = geo["lat"] if geo else None
            item["lon"] = geo["lon"] if geo else None
        return items
    finally:
        con.close()


def temporal() -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        return records(
            con.execute(
                """
            SELECT hour(time) AS hour, count(*) AS events,
                   round(avg(delay_in_min) FILTER (WHERE delay_in_min >= 0), 1) AS mean_delay,
                   round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                     / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 1) AS on_time_pct
            FROM read_parquet(?) WHERE time IS NOT NULL AND delay_in_min IS NOT NULL
            GROUP BY hour ORDER BY hour
        """,
                [source],
            )
        )
    finally:
        con.close()


def categories(limit: int = 50) -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        return records(
            con.execute(
                """
            SELECT train_type AS category, count(*) AS events,
                   avg(delay_in_min) FILTER (WHERE delay_in_min >= 0) AS mean_delay,
                   round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                     / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 1) AS on_time_pct,
                   count(*) FILTER (WHERE has_plan_record) AS planned,
                   count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled)) AS canceled
            FROM read_parquet(?) WHERE train_type IS NOT NULL
            GROUP BY train_type HAVING count(*) >= 20 ORDER BY events DESC LIMIT ?
        """,
                [source, limit],
            )
        )
    finally:
        con.close()


def cancellation_stations(limit: int = 100) -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        return records(
            con.execute(
                """
            SELECT eva AS id, coalesce(max(station_name), max(xml_station_name)) AS name,
                   count(*) FILTER (WHERE has_plan_record) AS planned,
                   count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled)) AS canceled,
                   round(100.0 * count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled))
                     / nullif(count(*) FILTER (WHERE has_plan_record), 0), 2) AS cancellation_pct
            FROM read_parquet(?) WHERE eva IS NOT NULL GROUP BY eva
            HAVING count(*) FILTER (WHERE has_plan_record) >= 20
            ORDER BY cancellation_pct DESC NULLS LAST LIMIT ?
        """,
                [source, limit],
            )
        )
    finally:
        con.close()


def route_segments(limit: int = 100) -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        return records(
            con.execute(
                """
            WITH ordered AS (
              SELECT *,
                lag(eva) OVER (PARTITION BY train_line_ride_id ORDER BY train_line_station_num, time, id) AS from_id,
                lag(coalesce(station_name, xml_station_name)) OVER (PARTITION BY train_line_ride_id ORDER BY train_line_station_num, time, id) AS from_name,
                lag(delay_in_min) OVER (PARTITION BY train_line_ride_id ORDER BY train_line_station_num, time, id) AS from_delay
              FROM read_parquet(?)
              WHERE train_line_ride_id IS NOT NULL AND train_line_station_num IS NOT NULL AND eva IS NOT NULL
            )
            SELECT from_id, from_name, eva AS to_id, coalesce(station_name, xml_station_name) AS to_name,
                   train_type, line_number, count(*) AS observed_runs,
                   count(*) FILTER (WHERE from_delay IS NOT NULL AND delay_in_min IS NOT NULL) AS paired_delay_runs,
                   avg(from_delay) FILTER (WHERE from_delay >= 0) AS mean_origin_nonnegative_delay,
                   avg(delay_in_min) FILTER (WHERE delay_in_min >= 0) AS mean_nonnegative_delay,
                   avg(delay_in_min - from_delay) FILTER (WHERE from_delay IS NOT NULL AND delay_in_min IS NOT NULL) AS mean_delay_change
            FROM ordered WHERE from_id IS NOT NULL AND from_id <> eva
            GROUP BY from_id, from_name, to_id, to_name, train_type, line_number
            HAVING count(*) >= 20 ORDER BY mean_nonnegative_delay DESC NULLS LAST LIMIT ?
        """,
                [source, limit],
            )
        )
    finally:
        con.close()


def delay_distribution(on_time_threshold: int = 5) -> dict:
    """Return delay quantiles and bins for non-null source delay observations."""
    source = parquet_glob()
    if source is None:
        return {"available": False, "items": []}
    con = connection()
    try:
        stats = con.execute(
            """
            SELECT count(*) AS timed_events,
                   count(*) FILTER (WHERE delay_in_min <= ?) AS on_time_events,
                   quantile_cont(delay_in_min, 0.5) AS median_delay,
                   quantile_cont(delay_in_min, 0.9) AS p90_delay,
                   quantile_cont(delay_in_min, 0.95) AS p95_delay,
                   sum(delay_in_min) FILTER (WHERE delay_in_min > 0) AS positive_delay_minutes
            FROM read_parquet(?) WHERE delay_in_min IS NOT NULL
            """,
            [on_time_threshold, source],
        ).fetchone()
        bins = records(
            con.execute(
                """
                SELECT CASE
                         WHEN delay_in_min < 0 THEN 'Early'
                         WHEN delay_in_min <= 5 THEN '0–5 min'
                         WHEN delay_in_min <= 15 THEN '6–15 min'
                         WHEN delay_in_min <= 30 THEN '16–30 min'
                         WHEN delay_in_min <= 60 THEN '31–60 min'
                         ELSE '>60 min'
                       END AS bucket,
                       CASE
                         WHEN delay_in_min < 0 THEN 0
                         WHEN delay_in_min <= 5 THEN 1
                         WHEN delay_in_min <= 15 THEN 2
                         WHEN delay_in_min <= 30 THEN 3
                         WHEN delay_in_min <= 60 THEN 4
                         ELSE 5
                       END AS bucket_order,
                       count(*) AS events
                FROM read_parquet(?) WHERE delay_in_min IS NOT NULL
                GROUP BY bucket, bucket_order ORDER BY bucket_order
                """,
                [source],
            )
        )
        timed, on_time, median, p90, p95, positive_minutes = stats
        return {
            "available": True,
            "timed_events": timed,
            "on_time_threshold_minutes": on_time_threshold,
            "on_time_events": on_time,
            "on_time_pct": round(on_time * 100 / timed, 2) if timed else None,
            "median_delay_minutes": median,
            "p90_delay_minutes": p90,
            "p95_delay_minutes": p95,
            "positive_delay_minutes": positive_minutes,
            "items": [{"bucket": row["bucket"], "events": row["events"]} for row in bins],
        }
    finally:
        con.close()


def event_page(limit: int = 50, offset: int = 0, station: str = "", train_type: str = "") -> dict:
    """Read a bounded page of source events for inspection; never scan unbounded into memory."""
    source = parquet_glob()
    if source is None:
        return {"available": False, "total": 0, "items": []}
    con = connection()
    try:
        where = "(? = '' OR lower(coalesce(station_name, xml_station_name, '')) LIKE '%' || lower(?) || '%') AND (? = '' OR lower(coalesce(train_type, '')) = lower(?))"
        params = [source, station, station, train_type, train_type]
        total = con.execute(
            f"SELECT count(*) FROM read_parquet(?) WHERE {where}", params
        ).fetchone()[0]
        items = records(
            con.execute(
                f"""
                SELECT id, time, eva, coalesce(station_name, xml_station_name) AS station_name,
                       train_type, train_number, line_number, delay_in_min,
                       arrival_is_canceled, departure_is_canceled, has_plan_record,
                       train_line_ride_id, train_line_station_num
                FROM read_parquet(?) WHERE {where}
                ORDER BY time DESC NULLS LAST, id LIMIT ? OFFSET ?
                """,
                [*params, limit, offset],
            )
        )
        return {"available": True, "total": total, "limit": limit, "offset": offset, "items": items}
    finally:
        con.close()


def coverage() -> dict:
    """Summarize installed monthly manifests and measured event coverage."""
    months = []
    for manifest_path in sorted(DATA_DIR.glob("*/manifest.json")):
        try:
            import json

            manifest = json.loads(manifest_path.read_text())
        except (OSError, ValueError):
            continue
        data_path = manifest_path.parent / "events.parquet"
        item = {
            "month": manifest.get("month", manifest_path.parent.name),
            "source_revision": manifest.get("source_revision"),
            "source_file": manifest.get("source_file"),
            "rows": manifest.get("rows"),
            "source_size_bytes": manifest.get("source_size_bytes"),
            "columns": manifest.get("columns", []),
            "available": data_path.is_file(),
        }
        if data_path.is_file():
            con = connection()
            try:
                start, end, stations_count = con.execute(
                    "SELECT min(time), max(time), count(DISTINCT eva) FROM read_parquet(?)",
                    [str(data_path)],
                ).fetchone()
                item.update(
                    start_time=str(start) if start is not None else None,
                    end_time=str(end) if end is not None else None,
                    stations=stations_count,
                )
            finally:
                con.close()
        months.append(item)
    return {"available": bool(months), "months": months}


def daily_temporal() -> list[dict]:
    source = parquet_glob()
    if source is None:
        return []
    con = connection()
    try:
        return records(
            con.execute(
                """
                SELECT CAST(time AS DATE) AS date, count(*) AS events,
                       count(*) FILTER (WHERE delay_in_min IS NOT NULL) AS timed_events,
                       round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                         / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 2) AS on_time_pct,
                       round(100.0 * count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled))
                         / nullif(count(*) FILTER (WHERE has_plan_record), 0), 2) AS cancellation_pct
                FROM read_parquet(?) WHERE time IS NOT NULL
                GROUP BY CAST(time AS DATE) ORDER BY date
                """,
                [source],
            )
        )
    finally:
        con.close()


def station_profile(eva: str) -> dict | None:
    source = parquet_glob()
    if source is None:
        return None
    con = connection()
    try:
        profile = con.execute(
            """
            SELECT eva AS id, coalesce(max(station_name), max(xml_station_name)) AS name,
                   count(*) AS events,
                   count(*) FILTER (WHERE delay_in_min IS NOT NULL) AS timed_events,
                   count(*) FILTER (WHERE delay_in_min IS NOT NULL AND delay_in_min <= 5) AS on_time_events,
                   round(100.0 * count(*) FILTER (WHERE delay_in_min IS NOT NULL AND delay_in_min <= 5)
                     / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 2) AS on_time_pct,
                   avg(delay_in_min) FILTER (WHERE delay_in_min >= 0) AS mean_nonnegative_delay,
                   quantile_cont(delay_in_min, 0.5) AS median_delay,
                   quantile_cont(delay_in_min, 0.9) AS p90_delay,
                   count(*) FILTER (WHERE has_plan_record) AS planned,
                   count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled)) AS canceled,
                   round(100.0 * count(*) FILTER (WHERE has_plan_record AND (arrival_is_canceled OR departure_is_canceled))
                     / nullif(count(*) FILTER (WHERE has_plan_record), 0), 2) AS cancellation_pct,
                   min(time) AS first_event, max(time) AS last_event
            FROM read_parquet(?) WHERE eva = ? GROUP BY eva
            """,
            [source, eva],
        ).fetchone()
        if profile is None:
            return None
        names = [column[0] for column in con.description]
        result = dict(zip(names, profile))
        result["hourly"] = records(
            con.execute(
                """
                SELECT hour(time) AS hour, count(*) AS events,
                       round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                         / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 2) AS on_time_pct,
                       avg(delay_in_min) FILTER (WHERE delay_in_min >= 0) AS mean_nonnegative_delay
                FROM read_parquet(?) WHERE eva = ? AND time IS NOT NULL
                GROUP BY hour ORDER BY hour
                """,
                [source, eva],
            )
        )
        result["categories"] = records(
            con.execute(
                """
                SELECT train_type AS category, count(*) AS events,
                       round(100.0 * count(*) FILTER (WHERE delay_in_min <= 5 AND delay_in_min IS NOT NULL)
                         / nullif(count(*) FILTER (WHERE delay_in_min IS NOT NULL), 0), 2) AS on_time_pct,
                       avg(delay_in_min) FILTER (WHERE delay_in_min >= 0) AS mean_nonnegative_delay
                FROM read_parquet(?) WHERE eva = ? AND train_type IS NOT NULL
                GROUP BY train_type ORDER BY events DESC
                """,
                [source, eva],
            )
        )
        geo = GEO_MAP.get(eva) or GEO_MAP.get(eva.lstrip("0"))
        result["lat"] = geo["lat"] if geo else None
        result["lon"] = geo["lon"] if geo else None
        return result
    finally:
        con.close()
