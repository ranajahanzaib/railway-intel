# Architecture

```text
Hugging Face monthly Parquet → Polars schema validation → partitioned local Parquet
                                                        ↓
                                            DuckDB / dbt-duckdb
                                                        ↓
                                     FastAPI analytical endpoints
                                                        ↓
                                     Next.js responsive workspace
```

Monthly source files are immutable inputs; the pipeline writes normalized files and a manifest under `data/processed`. DuckDB scans the Parquet dataset directly for bounded aggregations. dbt models express reusable normalized events and reliability marts. The API reports `available: false` when there are no local records.

The source feed contains observed stop records, not a complete passenger journey ledger. Route continuity and operator attribution require additional source evidence and are not inferred from station proximity or train type. Geography is supplied separately by a versioned DELFI GTFS feed; current timetable data is not assumed to represent historical service.

Local clocks are preserved as Europe/Berlin wall time. Source revision, file, license, date range, schema, and row count are recorded in the manifest. Deployments can publish a validated dataset directory atomically and point readers at the completed snapshot so API requests do not observe partially written files.
