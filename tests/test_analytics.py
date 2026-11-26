from datetime import datetime

import polars as pl
import pytest
from fastapi.testclient import TestClient

from railway_intel import analytics, cli
from railway_intel.api import app


def test_empty_data_is_explicit(monkeypatch, tmp_path):
    monkeypatch.setattr(analytics, "DATA_DIR", tmp_path)
    assert analytics.summary() == {
        "available": False,
        "reason": "No processed railway dataset is installed.",
        "coverage": None,
    }
    assert analytics.stations() == []
    assert analytics.temporal() == []


def test_api_reports_empty_data_and_bounds_queries(monkeypatch, tmp_path):
    monkeypatch.setattr(analytics, "DATA_DIR", tmp_path)
    client = TestClient(app)

    assert client.get("/api/v1/health").json() == {
        "status": "ok",
        "data_available": False,
    }
    assert client.get("/api/v1/summary").json()["available"] is False
    assert client.get("/api/v1/stations?limit=0").status_code == 422
    assert client.get("/api/v1/delays/distribution?on_time_threshold=61").status_code == 422
    assert client.get("/api/v1/data/events?limit=101").status_code == 422
    assert client.get("/api/v1/coverage").json() == {"available": False, "months": []}
    assert client.get("/api/v1/stations/unknown-eva").status_code == 404


def test_metrics_keep_missing_and_negative_delays_out_of_on_time_denominator(monkeypatch, tmp_path):
    source = tmp_path / "2026-10"
    source.mkdir()
    pl.DataFrame(
        {
            "id": [str(i) for i in range(20)],
            "eva": ["123"] * 20,
            "station_name": ["Example"] * 20,
            "xml_station_name": ["Example"] * 20,
            "time": [datetime(2026, 10, 1, 8)] * 19 + [datetime(2026, 10, 1, 9)],
            "delay_in_min": [0, 10, *([0] * 17), None],
            "arrival_is_canceled": [False, True, *([False] * 18)],
            "departure_is_canceled": [False] * 20,
            "has_plan_record": [True] * 20,
            "train_type": ["ICE"] * 20,
            "train_line_ride_id": [f"ride-{i}" for i in range(20)],
            "train_line_station_num": [1] * 20,
            "line_number": ["10"] * 20,
        }
    ).write_parquet(source / "events.parquet")
    monkeypatch.setattr(analytics, "DATA_DIR", tmp_path)

    result = analytics.summary()
    assert result["observations"] == 20
    assert result["stations"] == 1
    assert result["on_time_pct"] == 94.7
    assert result["canceled"] == 1
    assert result["planned"] == 20
    assert analytics.stations()[0]["mean_delay"] == 0.5
    assert analytics.stations()[0]["on_time_pct"] == 94.7
    assert analytics.temporal()[0]["hour"] == 8
    assert analytics.categories()[0]["category"] == "ICE"
    assert analytics.cancellation_stations()[0]["cancellation_pct"] == 5.0


def test_route_segments_follow_observed_run_order(monkeypatch, tmp_path):
    rows = []
    for run in range(20):
        for position, (eva, name) in enumerate([("100", "Alpha"), ("200", "Beta")], start=1):
            rows.append(
                {
                    "id": f"{run}-{position}",
                    "eva": eva,
                    "station_name": name,
                    "xml_station_name": name,
                    "time": datetime(2026, 10, 1, 8, position),
                    "delay_in_min": 4 if position == 1 else 8,
                    "arrival_is_canceled": False,
                    "departure_is_canceled": False,
                    "has_plan_record": True,
                    "train_type": "ICE",
                    "train_line_ride_id": f"run-{run}",
                    "train_line_station_num": position,
                    "line_number": "10",
                }
            )
    pl.DataFrame(rows).write_parquet(tmp_path / "routes.parquet")
    monkeypatch.setattr(analytics, "DATA_DIR", tmp_path)

    segments = analytics.route_segments()
    assert len(segments) == 1
    assert (segments[0]["from_id"], segments[0]["to_id"]) == ("100", "200")
    assert segments[0]["observed_runs"] == 20
    assert segments[0]["paired_delay_runs"] == 20
    assert segments[0]["mean_origin_nonnegative_delay"] == 4.0
    assert segments[0]["mean_nonnegative_delay"] == 8.0
    assert segments[0]["mean_delay_change"] == 4.0


def test_delay_distribution_bounded_event_explorer_and_coverage(monkeypatch, tmp_path):
    month = tmp_path / "2026-10"
    month.mkdir()
    pl.DataFrame(
        {
            "id": ["a", "b", "c", "d"],
            "eva": ["123", "123", "456", "456"],
            "station_name": ["Example", "Example", "Other", "Other"],
            "xml_station_name": ["Example", "Example", "Other", "Other"],
            "time": [datetime(2026, 10, day, 8) for day in range(1, 5)],
            "delay_in_min": [-2, 4, 14, 35],
            "arrival_is_canceled": [False, False, False, True],
            "departure_is_canceled": [False] * 4,
            "has_plan_record": [True] * 4,
            "train_type": ["ICE", "ICE", "RE", "RE"],
            "train_number": ["1", "1", "2", "2"],
            "line_number": ["10", "10", "20", "20"],
            "train_line_ride_id": ["r1", "r1", "r2", "r2"],
            "train_line_station_num": [1, 2, 1, 2],
        }
    ).write_parquet(month / "events.parquet")
    (month / "manifest.json").write_text(
        '{"month":"2026-10","source_revision":"abc123","rows":4,"columns":["eva"]}'
    )
    monkeypatch.setattr(analytics, "DATA_DIR", tmp_path)

    distribution = analytics.delay_distribution(5)
    assert distribution["timed_events"] == 4
    assert distribution["on_time_events"] == 2
    assert distribution["median_delay_minutes"] == 9.0
    assert distribution["items"] == [
        {"bucket": "Early", "events": 1},
        {"bucket": "0–5 min", "events": 1},
        {"bucket": "6–15 min", "events": 1},
        {"bucket": "31–60 min", "events": 1},
    ]
    page = analytics.event_page(limit=1, offset=0, station="example", train_type="ICE")
    assert page["total"] == 2
    assert len(page["items"]) == 1
    assert page["items"][0]["station_name"] == "Example"
    coverage = analytics.coverage()
    assert coverage["months"][0]["source_revision"] == "abc123"
    assert coverage["months"][0]["stations"] == 2
    assert len(analytics.daily_temporal()) == 4
    profile = analytics.station_profile("123")
    assert profile is not None
    assert profile["events"] == 2
    assert profile["on_time_pct"] == 100.0
    assert profile["hourly"][0]["events"] == 2
    assert {row["category"] for row in profile["categories"]} == {"ICE"}


def test_cli_normalize_validates_input_and_schema(tmp_path):
    # Invalid month format
    with pytest.raises(SystemExit, match="Month must use YYYY-MM format"):
        cli.normalize("202407", tmp_path)

    # Missing input file
    with pytest.raises(SystemExit, match="Local source file not found"):
        cli.normalize("2024-07", tmp_path)

    # Missing required columns
    bad_file = tmp_path / "bad.parquet"
    pl.DataFrame({"eva": ["123"]}).write_parquet(bad_file)
    with pytest.raises(SystemExit, match="Source schema missing required columns"):
        cli.normalize("2024-07", tmp_path, file=bad_file)

    # Valid normalization
    valid_file = tmp_path / "valid.parquet"
    pl.DataFrame(
        {
            "eva": ["123"],
            "time": [datetime(2024, 7, 1, 8)],
            "delay_in_min": [0],
            "arrival_is_canceled": [False],
            "departure_is_canceled": [False],
            "station_name": ["Berlin Hbf"],
        }
    ).write_parquet(valid_file)
    cli.normalize("2024-07", tmp_path, file=valid_file)
    dest_parquet = tmp_path / "processed" / "2024-07" / "events.parquet"
    dest_manifest = tmp_path / "processed" / "2024-07" / "manifest.json"
    assert dest_parquet.is_file()
    assert dest_manifest.is_file()

