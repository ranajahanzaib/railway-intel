"""Dataset discovery and selective source download commands."""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import httpx
import polars as pl

REPO = "piebro/deutsche-bahn-data"
API = f"https://huggingface.co/api/datasets/{REPO}/tree/main/monthly_processed_data"


def source_files():
    response = httpx.get(API, params={"recursive": "true", "expand": "true"}, timeout=60)
    response.raise_for_status()
    return [item for item in response.json() if item.get("path", "").endswith(".parquet")]


def discover():
    files = source_files()
    print(
        json.dumps(
            [
                {
                    "path": f["path"],
                    "size": f.get("size"),
                    "revision": f.get("lastCommit", {}).get("id"),
                }
                for f in files
            ],
            indent=2,
        )
    )


def download(month: str, out: Path):
    if len(month) != 7 or month[4] != "-":
        raise SystemExit("Month must use YYYY-MM format")
    out.mkdir(parents=True, exist_ok=True)
    source_path = f"monthly_processed_data/data-{month}.parquet"
    source = next((item for item in source_files() if item.get("path") == source_path), None)
    if source is None:
        raise SystemExit(
            f"Source does not publish {source_path}. Run `railway-intel discover` to list available months."
        )
    file = out / source_path
    file.parent.mkdir(parents=True, exist_ok=True)
    if not file.exists():
        staging_source = file.with_suffix(".parquet.download")
        revision = source.get("lastCommit", {}).get("id", "main")
        url = f"https://huggingface.co/datasets/{REPO}/resolve/{revision}/{source_path}"
        with httpx.stream(
            "GET",
            url,
            params={"download": "true"},
            timeout=httpx.Timeout(30, read=120),
            follow_redirects=True,
        ) as response:
            response.raise_for_status()
            with staging_source.open("wb") as handle:
                for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                    handle.write(chunk)
        expected_size = source.get("size")
        actual_size = staging_source.stat().st_size
        if expected_size is not None and actual_size != expected_size:
            staging_source.unlink(missing_ok=True)
            raise SystemExit(
                f"Downloaded source size mismatch: expected {expected_size}, got {actual_size}"
            )
        staging_source.replace(file)
    if not file.is_file():
        raise SystemExit(f"Expected source file missing after download: {file}")
    normalize(month, out, file, source)


def normalize(month: str, out: Path, file: Path | None = None, source: dict | None = None):
    if len(month) != 7 or month[4] != "-":
        raise SystemExit("Month must use YYYY-MM format")
    source_path = f"monthly_processed_data/data-{month}.parquet"
    file = file or (out / source_path)
    if not file.is_file():
        raise SystemExit(f"Local source file not found: {file}")
    dest = out / "processed" / month
    dest.mkdir(parents=True, exist_ok=True)
    prior_manifest_path = dest / "manifest.json"
    prior_manifest = (
        json.loads(prior_manifest_path.read_text())
        if source is None and prior_manifest_path.is_file()
        else {}
    )
    frame = pl.scan_parquet(file)
    columns = frame.collect_schema().names()
    required = {"eva", "time", "delay_in_min", "arrival_is_canceled", "departure_is_canceled"}
    missing = required - set(columns)
    if missing:
        raise SystemExit(f"Source schema missing required columns {sorted(missing)}: {file}")
    staging = dest / "events.parquet.staging"
    frame.sink_parquet(staging, compression="zstd")
    output = dest / "events.parquet"
    staging.replace(output)
    manifest = {
        "source": f"https://huggingface.co/datasets/{REPO}",
        "license": "CC BY 4.0",
        "source_file": source_path,
        "source_revision": source.get("lastCommit", {}).get("id")
        if source
        else prior_manifest.get("source_revision"),
        "source_size_bytes": source.get("size", file.stat().st_size)
        if source
        else prior_manifest.get("source_size_bytes", file.stat().st_size),
        "source_blob_oid": source.get("oid") if source else prior_manifest.get("source_blob_oid"),
        "source_xet_hash": source.get("xetHash")
        if source
        else prior_manifest.get("source_xet_hash"),
        "month": month,
        "normalized_at": datetime.now(UTC).isoformat(),
        "rows": pl.scan_parquet(output).select(pl.len()).collect().item(),
        "columns": columns,
    }
    manifest_stage = dest / "manifest.json.staging"
    manifest_stage.write_text(json.dumps(manifest, indent=2))
    manifest_stage.replace(dest / "manifest.json")
    print(f"Published {manifest['rows']:,} rows to {dest}")


def main():
    parser = argparse.ArgumentParser(prog="railway-intel")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("discover")
    for name in ("download", "normalize"):
        command = commands.add_parser(name)
        command.add_argument("--month", required=True)
        command.add_argument("--output", type=Path, default=Path("data"))
    args = parser.parse_args()
    if args.command == "discover":
        discover()
    elif args.command == "download":
        download(args.month, args.output)
    else:
        normalize(args.month, args.output)


if __name__ == "__main__":
    main()
