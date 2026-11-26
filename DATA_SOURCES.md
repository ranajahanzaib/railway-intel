# Data sources

## Primary operational history

- Repository: https://github.com/piebro/deutsche-bahn-data
- Dataset: https://huggingface.co/datasets/piebro/deutsche-bahn-data
- Source data license: CC BY 4.0, attributed to Deutsche Bahn; dataset collection by Piet Brömmel.
- Monthly processed Parquet has EVA, station labels, event time, delay, arrival/departure cancellation flags, train type and number, plan/change times, train run ID and order, and additional/replacement service flags.
- The source documents local Europe/Berlin timestamps, coverage expansion after 2025-11-02, and missing hours in several months during 2025–2026.
- The dataset is very large. Download selected months to limit storage and processing requirements.

## Geographic and timetable context

Nationwide DELFI GTFS is available from [OpenData ÖPNV](https://www.opendata-oepnv.de/). Railway Intel does not currently ingest this feed, so station coordinates and map overlays are unavailable. Any future geographic analysis needs to retain each feed's validity dates; current coordinates do not establish historical route topology. OpenStreetMap basemap tiles are not bundled or bulk-downloaded.

## Attribution

Attribution: “Historical stop-event data: Deutsche Bahn public timetable APIs, collected and published by Piet Brömmel, CC BY 4.0.” Railway Intel is independent analysis and is not an official Deutsche Bahn product.
