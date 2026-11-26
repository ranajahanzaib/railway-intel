{{ config(materialized='table') }}

select
  extract(hour from event_time_local)::integer as local_hour,
  count(*) as observed_events,
  avg(delay_minutes) filter (where delay_minutes >= 0) as mean_nonnegative_delay_minutes,
  count(*) filter (where delay_minutes <= 5 and delay_minutes is not null)::double
    / nullif(count(*) filter (where delay_minutes is not null), 0) as on_time_share,
  count(*) filter (where is_canceled) as canceled_events
from {{ ref('stg_stop_events') }}
where delay_minutes is not null
group by local_hour
order by local_hour
