# API

Base path: `/api/v1`. Interactive OpenAPI docs are served by FastAPI at `/docs`.

| Method/path                                               | Purpose                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /health`                                             | Process and local-data readiness                                                   |
| `GET /summary`                                            | Observation count, date coverage, station count, on-time share, cancellation count |
| `GET /stations?limit=100&q=`                              | Station aggregates with a 20-event minimum                                         |
| `GET /stations/{eva}`                                     | Station profile with observed delay, cancellation, hourly, and train-type metrics  |
| `GET /temporal/hourly`                                    | Observed delay aggregates by German local hour                                     |
| `GET /temporal/daily`                                     | Daily event counts, on-time share, and planned-record cancellation share           |
| `GET /delays/distribution?on_time_threshold=5`            | Event delay quantiles, positive delay total, and distribution buckets              |
| `GET /data/events?limit=50&offset=0&station=&train_type=` | Bounded, filterable source event rows (maximum 100 per page and offset 100,000)    |
| `GET /coverage`                                           | Installed source manifests plus measured event date/station coverage               |
| `GET /categories?limit=50`                                | Observed train-type aggregates                                                     |
| `GET /cancellations/stations?limit=100`                   | Station cancellation share using source rows with a plan record as the denominator |
| `GET /routes/segments?limit=100`                          | Consecutive observed station pairs within source train-run order                   |

Summary returns `available: false` with a reason when no Parquet data exists. Null metric values mean no valid denominator. CSV export is generated client-side from the returned station results. Event rows are paginated and bounded; the UI exports only the currently visible page. Aggregate exports are generated client-side from the returned bounded result sets.
