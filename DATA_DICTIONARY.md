# Data dictionary

| Field                                             | Meaning                                                   |
| ------------------------------------------------- | --------------------------------------------------------- |
| `id`                                              | Source stop-event identifier                              |
| `eva`                                             | Station EVA identifier                                    |
| `station_name`, `xml_station_name`                | Processed and XML station labels                          |
| `time`                                            | Reported event timestamp in German local time             |
| `delay_in_min`                                    | Source-reported delay in minutes; may be null or negative |
| `arrival_is_canceled`, `departure_is_canceled`    | Arrival/departure cancellation flags                      |
| `has_plan_record`                                 | Whether a corresponding planned record exists             |
| `train_type`, `train_number`, `line_number`       | Source train/category/run/line labels                     |
| `train_line_ride_id`, `train_line_station_num`    | Source train run grouping and station order               |
| `is_additional_stop`, `is_replacement_train`      | Source indicators for extra/replacement service           |
| `arrival_planned_time`, `arrival_change_time`     | Planned and changed arrival time                          |
| `departure_planned_time`, `departure_change_time` | Planned and changed departure time                        |

The upstream schema is authoritative; columns can evolve. Ingestion validates required fields and records the complete schema in each manifest.
