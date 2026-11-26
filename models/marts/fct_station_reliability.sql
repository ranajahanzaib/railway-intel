{{ config(materialized='table') }}

select
  station_id,
  max(station_name) as station_name,
  count(*) as observed_events,
  count(*) filter (where delay_minutes is not null) as events_with_delay,
  avg(delay_minutes) filter (where delay_minutes >= 0) as mean_nonnegative_delay_minutes,
  quantile_cont(delay_minutes, 0.5) filter (where delay_minutes is not null) as median_delay_minutes,
  count(*) filter (where delay_minutes <= 5 and delay_minutes is not null)::double
    / nullif(count(*) filter (where delay_minutes is not null), 0) as on_time_share,
  count(*) filter (where is_canceled) as canceled_events,
  count(*) filter (where has_plan_record) as planned_events,
  count(distinct cast(event_time_local as date)) as observed_days,
  min(event_time_local) as first_observation_local,
  max(event_time_local) as last_observation_local
from {{ ref('stg_stop_events') }}
group by station_id
having count(*) >= 20
