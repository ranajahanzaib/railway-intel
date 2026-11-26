# Performance

Source ingestion is performed one month at a time, and DuckDB aggregates directly from Parquet. API requests scan the configured Parquet files, which suits the local quickstart and selected-month analysis. This version has no published full-archive or multi-user performance benchmarks, and does not provide a production capacity guarantee.
