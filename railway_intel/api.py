from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from railway_intel import analytics

app = FastAPI(
    title="Railway Intel API", version="1", description="Historical railway reliability analytics"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "data_available": analytics.parquet_glob() is not None}


@app.get("/api/v1/summary")
def get_summary():
    return analytics.summary()


@app.get("/api/v1/stations")
def get_stations(limit: int = Query(100, ge=1, le=1000), q: str = ""):
    return {"items": analytics.stations(limit, q)}


@app.get("/api/v1/stations/{eva}")
def get_station_profile(eva: str):
    result = analytics.station_profile(eva)
    if result is None:
        raise HTTPException(status_code=404, detail="Station not present in installed source data")
    return result


@app.get("/api/v1/temporal/hourly")
def get_temporal():
    return {"items": analytics.temporal()}


@app.get("/api/v1/categories")
def get_categories(limit: int = Query(50, ge=1, le=200)):
    return {"items": analytics.categories(limit)}


@app.get("/api/v1/cancellations/stations")
def get_cancellation_stations(limit: int = Query(100, ge=1, le=1000)):
    return {"items": analytics.cancellation_stations(limit)}


@app.get("/api/v1/routes/segments")
def get_route_segments(limit: int = Query(100, ge=1, le=1000)):
    return {"items": analytics.route_segments(limit)}


@app.get("/api/v1/delays/distribution")
def get_delay_distribution(on_time_threshold: int = Query(5, ge=0, le=60)):
    return analytics.delay_distribution(on_time_threshold)


@app.get("/api/v1/data/events")
def get_event_page(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100_000),
    station: str = Query("", max_length=100),
    train_type: str = Query("", max_length=40),
):
    return analytics.event_page(limit, offset, station, train_type)


@app.get("/api/v1/coverage")
def get_coverage():
    return analytics.coverage()


@app.get("/api/v1/temporal/daily")
def get_daily_temporal():
    return {"items": analytics.daily_temporal()}
