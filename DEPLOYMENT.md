# Deployment

Run the local stack with `make dev`, or use Docker Compose for the API and Next.js frontend. To ingest a month in a one-off container, run `MONTH=2024-07 docker compose --profile ingestion run --rm ingest`; source and normalized Parquet files persist in a named volume. Compose builds the frontend with `http://localhost:8000` as its browser-visible API base. Configure that value for your reverse-proxy hostname when building another environment. Keep source files, processed Parquet, and DuckDB snapshots on persistent storage outside the image. Mount validated data read-only in API containers. A reverse proxy should route `/api` to FastAPI and the remaining paths to Next.js.

Keep secrets and large datasets out of images. Publish a new data snapshot to a separate directory, validate it, then switch the mounted snapshot atomically so active readers do not see partial files.
