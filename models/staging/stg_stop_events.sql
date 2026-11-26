{{ config(materialized='view') }}

select
  cast(id as varchar) as event_id,
  cast(eva as varchar) as station_id,
  coalesce(station_name, xml_station_name) as station_name,
  cast(time as timestamp) as event_time_local,
  cast(delay_in_min as integer) as delay_minutes,
  coalesce(arrival_is_canceled, false) or coalesce(departure_is_canceled, false) as is_canceled,
  coalesce(has_plan_record, false) as has_plan_record,
  train_type,
  train_number,
  line_number,
  train_line_ride_id,
  train_line_station_num,
  coalesce(is_additional_stop, false) as is_additional_stop,
  coalesce(is_replacement_train, false) as is_replacement_train
from read_parquet('data/processed/**/*.parquet', union_by_name=true)
where eva is not null and time is not null
