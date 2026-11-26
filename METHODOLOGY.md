# Methodology

## Metrics

- A stop event is considered on time when a non-null `delay_in_min` is at most five minutes. The numerator and denominator both exclude missing delays.
- Mean non-negative delay is the arithmetic mean over reported values at or above zero. Early events are excluded and must not be interpreted as zero delay. The delay laboratory reports median, P90, and P95 from all non-null reported values (including early values) and separately sums values above zero.
- Cancellation is the union of arrival and departure cancellation flags at a stop. This is an event count, not a unique canceled train count.
- Station cancellation share uses rows with `has_plan_record=true` as the planned denominator. Cancellation numerators are restricted to that same subset. It is a stop-record ratio, not a count of unique canceled train services.
- Route segment rows are adjacent EVA stop records ordered by the source train-run identifier and station sequence. The route view reports non-negative origin and destination mean delay plus the mean event-level difference when both delays are present. A negative difference is consistent with recovery between observed stops but does not establish cause. These are observed stop pairs, not a verified line geometry or complete journey path.
- Train-category aggregates use the source `train_type` field; null categories are omitted.
- The source includes rows without a plan record, additional stops, and replacement services. These are retained and exposed as source fields; consumers should choose an appropriate denominator for their question.
- Station tables suppress groups below 20 observations. This is a display threshold, not proof of statistical significance. Delay quantiles are event-weighted and are not adjusted for repeated service, station coverage, or source collection changes. Rankings are descriptive and do not include inferential uncertainty adjustments.

## Limits

The primary data is a periodic snapshot history of timetable API state, not a ground-truth train movement sensor. Timestamps are German local time. Coverage changed from roughly 100 large stations before November 2025 to the broader network afterwards, and upstream documents missing hours in multiple months. Reported historical changes can reflect coverage and collection changes as well as service performance. No causal delay labels, passenger delay minutes, passenger counts, train coordinates, or infrastructure condition are present in the core feed.

Station cancellation shares use the source planned-record flag, but remain stop-record ratios rather than unique-service rates. The current dataset does not support operator comparisons, uncertainty estimates, or validated route accumulation profiles.
