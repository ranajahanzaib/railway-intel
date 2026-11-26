"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
type Row = Record<string, string | number | boolean | null>;
const fmt = (value: number | null | undefined, digits = 1) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(
        value,
      );

export function DelayLaboratory() {
  const [threshold, setThreshold] = useState(5);
  const [data, setData] = useState<{
    available: boolean;
    timed_events?: number;
    on_time_pct?: number | null;
    median_delay_minutes?: number | null;
    p90_delay_minutes?: number | null;
    p95_delay_minutes?: number | null;
    positive_delay_minutes?: number | null;
    items: Row[];
  }>({ available: false, items: [] });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/v1/delays/distribution?on_time_threshold=${threshold}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted)
          setData({ available: false, items: [] });
      });
    return () => controller.abort();
  }, [threshold]);
  const max = Math.max(1, ...data.items.map((row) => Number(row.events || 0)));
  return (
    <>
      <section className="metrics">
        <DataMetric
          label="TIMED OBSERVATIONS"
          value={fmt(data.timed_events, 0)}
          note="Rows with a reported delay"
        />
        <DataMetric
          label="MEDIAN REPORTED DELAY"
          value={
            data.median_delay_minutes == null
              ? "—"
              : `${fmt(data.median_delay_minutes)} min`
          }
          note="All non-null source delays, including early arrivals"
        />
        <DataMetric
          label="P90 / P95"
          value={
            data.p90_delay_minutes == null
              ? "—"
              : `${fmt(data.p90_delay_minutes)} / ${fmt(data.p95_delay_minutes)} min`
          }
          note="Observed event-level quantiles"
        />
        <DataMetric
          label="POSITIVE DELAY MINUTES"
          value={fmt(data.positive_delay_minutes, 0)}
          note="Sum of reported delays greater than zero"
        />
      </section>
      <section className="panel analysis-panel">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">REPORTED DELAY DISTRIBUTION</div>
            <h2>How late were observed events?</h2>
          </div>
        </div>
        <div className="threshold-control">
          <label htmlFor="threshold">
            On-time threshold <strong>{threshold} minutes</strong>
          </label>
          <input
            id="threshold"
            type="range"
            min="0"
            max="30"
            step="1"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
          <span>
            {fmt(data.on_time_pct)}% of timed events are at or below this
            threshold, including early events.
          </span>
        </div>
        <div className="distribution-list">
          {data.items.map((row) => (
            <div className="distribution-row" key={String(row.bucket)}>
              <span>{row.bucket}</span>
              <div className="distribution-track">
                <i
                  style={{ width: `${(Number(row.events || 0) / max) * 100}%` }}
                />
              </div>
              <b>{fmt(Number(row.events), 0)}</b>
            </div>
          ))}
        </div>
        {!data.available && (
          <div className="empty-row">
            Install a real monthly source file to calculate the delay
            distribution.
          </div>
        )}
        <div className="analysis-note">
          Percentiles and bins are computed from event-level reported delay
          values. The source does not provide passenger-weighted delay or a
          cause for any delay.
        </div>
      </section>
    </>
  );
}

export function CoverageObservatory() {
  const [months, setMonths] = useState<Row[]>([]);
  useEffect(() => {
    fetch(`${API}/api/v1/coverage`)
      .then((response) => response.json())
      .then((data) => setMonths(data.months || []))
      .catch(() => setMonths([]));
  }, []);
  const rows = months;
  const total = rows.reduce((sum, row) => sum + Number(row.rows || 0), 0);
  return (
    <>
      <section className="metrics">
        <DataMetric
          label="INSTALLED MONTHS"
          value={fmt(rows.length, 0)}
          note="Months with a local manifest"
        />
        <DataMetric
          label="LOCAL OBSERVATIONS"
          value={fmt(total, 0)}
          note="Sum of manifest row counts"
        />
        <DataMetric
          label="MEASURED STATIONS"
          value={fmt(
            Math.max(0, ...rows.map((row) => Number(row.stations || 0))),
            0,
          )}
          note="Maximum distinct EVA count in one month"
        />
        <DataMetric
          label="SOURCE RANGE"
          value={
            rows.length
              ? `${String(rows[0].month)} — ${String(rows[rows.length - 1].month)}`
              : "—"
          }
          note="Installed month labels; gaps are not inferred"
        />
      </section>
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">LOCAL MANIFESTS</div>
            <h2>Installed source coverage</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>MONTH</th>
                <th>OBSERVED START</th>
                <th>OBSERVED END</th>
                <th>ROWS</th>
                <th>STATIONS</th>
                <th>FILE SIZE</th>
                <th>SOURCE REVISION</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.month)}>
                  <td className="mono">{String(row.month)}</td>
                  <td>{String(row.start_time || "—")}</td>
                  <td>{String(row.end_time || "—")}</td>
                  <td className="mono">{fmt(Number(row.rows), 0)}</td>
                  <td className="mono">{fmt(Number(row.stations), 0)}</td>
                  <td className="mono">
                    {fmt(Number(row.source_size_bytes) / 1_000_000)} MB
                  </td>
                  <td className="mono">
                    {String(row.source_revision || "unrecorded")}
                  </td>
                  <td>{row.available ? "Installed" : "Manifest only"}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    No local manifests found. Download and normalize a real
                    monthly source file to establish coverage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="analysis-note">
          This view reports only locally installed files. It does not imply
          continuous archive coverage or extrapolate source coverage between
          releases.
        </div>
      </section>
    </>
  );
}

export function EventExplorer() {
  const [station, setStation] = useState("");
  const [trainType, setTrainType] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{
    available: boolean;
    total: number;
    items: Row[];
  }>({ available: false, total: 0, items: [] });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = new URLSearchParams({
        limit: "50",
        offset: String(offset),
        station,
        train_type: trainType,
      });
      fetch(`${API}/api/v1/data/events?${query}`, { signal: controller.signal })
        .then((response) => response.json())
        .then(setData)
        .catch(() => {
          if (!controller.signal.aborted)
            setData({ available: false, total: 0, items: [] });
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [station, trainType, offset]);
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };
  const exportPage = () => {
    if (!data.items.length) return;
    const keys = Object.keys(data.items[0]);
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const content = [
      keys.join(","),
      ...data.items.map((row) => keys.map((key) => quote(row[key])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `railway-intel-events-${offset}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="panel table-panel">
      <div className="panel-head table-head">
        <div>
          <div className="panel-kicker">SOURCE EVENT RECORDS</div>
          <h2>Inspect bounded event rows</h2>
        </div>
        <div className="table-tools">
          <input
            className="data-filter"
            aria-label="Filter by station"
            placeholder="Station name"
            value={station}
            onChange={(event) => filter(setStation)(event.target.value)}
          />
          <input
            className="data-filter short"
            aria-label="Filter by exact train type"
            placeholder="Train type"
            value={trainType}
            onChange={(event) => filter(setTrainType)(event.target.value)}
          />
          <button className="quiet-btn" onClick={exportPage}>
            Export this page
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>EVENT TIME</th>
              <th>STATION</th>
              <th>EVA</th>
              <th>TYPE</th>
              <th>TRAIN</th>
              <th>LINE</th>
              <th>DELAY</th>
              <th>ARR. CANCELED</th>
              <th>DEP. CANCELED</th>
              <th>PLAN</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row, index) => (
              <tr key={String(row.id || index)}>
                <td className="mono">{String(row.time || "—")}</td>
                <td>{String(row.station_name || "—")}</td>
                <td className="mono">{String(row.eva || "—")}</td>
                <td>{String(row.train_type || "—")}</td>
                <td className="mono">{String(row.train_number || "—")}</td>
                <td className="mono">{String(row.line_number || "—")}</td>
                <td className="mono">
                  {row.delay_in_min == null
                    ? "—"
                    : `${fmt(Number(row.delay_in_min))} min`}
                </td>
                <td>{row.arrival_is_canceled ? "Yes" : "No"}</td>
                <td>{row.departure_is_canceled ? "Yes" : "No"}</td>
                <td>{row.has_plan_record ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!data.items.length && (
              <tr>
                <td colSpan={10} className="empty-row">
                  {data.available
                    ? "No source rows match these filters."
                    : "No local source rows are available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          Rows are sorted by observed event time. Export is limited to the
          visible 50-row page.
        </span>
        <span className="pager">
          <button
            className="quiet-btn"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </button>
          <b>
            {data.total
              ? `${offset + 1}–${Math.min(offset + 50, data.total)} of ${fmt(data.total, 0)}`
              : "0 rows"}
          </b>
          <button
            className="quiet-btn"
            disabled={offset + 50 >= data.total}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </button>
        </span>
      </div>
    </section>
  );
}

export function DailyCalendar() {
  const [days, setDays] = useState<Row[]>([]);
  useEffect(() => {
    fetch(`${API}/api/v1/temporal/daily`)
      .then((response) => response.json())
      .then((data) => setDays(data.items || []))
      .catch(() => setDays([]));
  }, []);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const first = days.length
    ? new Date(`${String(days[0].date)}T00:00:00Z`)
    : null;
  const cells = first ? [...Array(first.getUTCDay()).fill(null), ...days] : [];
  const rates = days.map((row) => Number(row.on_time_pct || 0));
  const lowRate = rates.length ? Math.min(...rates) : 0;
  const highRate = rates.length ? Math.max(...rates) : 0;
  return (
    <>
      <section className="metrics">
        <DataMetric
          label="OBSERVED DAYS"
          value={fmt(days.length, 0)}
          note="Days with event rows; missing dates are not filled"
        />
        <DataMetric
          label="PERIOD START"
          value={days.length ? String(days[0].date) : "—"}
          note="Source-local event date"
        />
        <DataMetric
          label="PERIOD END"
          value={days.length ? String(days[days.length - 1].date) : "—"}
          note="Source-local event date"
        />
        <DataMetric
          label="TIME ZONE"
          value="Europe / Berlin"
          note="Source timestamps are local clock time"
        />
      </section>
      <section className="panel calendar-panel">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">DAILY RELIABILITY FINGERPRINT</div>
            <h2>
              {first
                ? first.toLocaleString("en", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : "Observed calendar"}
            </h2>
          </div>
          <div className="calendar-legend">
            <i /> Higher punctuality <i /> Lower punctuality
          </div>
        </div>
        {days.length ? (
          <div className="calendar-grid">
            {dayNames.map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}
            {cells.map((row, index) =>
              row ? (
                <div
                  className="calendar-day"
                  key={String(row.date)}
                  title={`${row.date}: ${fmt(Number(row.on_time_pct))}% on time from ${fmt(Number(row.timed_events), 0)} timed events; ${fmt(Number(row.cancellation_pct))}% cancellations of planned records`}
                  style={
                    {
                      "--day-quality": `${highRate === lowRate ? 0.5 : 0.18 + (0.62 * (Number(row.on_time_pct || 0) - lowRate)) / (highRate - lowRate)}`,
                    } as React.CSSProperties
                  }
                >
                  <b>
                    {new Date(`${String(row.date)}T00:00:00Z`).getUTCDate()}
                  </b>
                  <span>{fmt(Number(row.on_time_pct))}%</span>
                  <small>
                    {fmt(Number(row.events), 0)} ev ·{" "}
                    {fmt(Number(row.cancellation_pct))}% cx
                  </small>
                </div>
              ) : (
                <div className="calendar-empty" key={`empty-${index}`} />
              ),
            )}
          </div>
        ) : (
          <div className="empty-row">
            A reliability calendar appears when daily historical observations
            are installed.
          </div>
        )}
        <div className="analysis-note">
          Each cell uses rows recorded on that source-local calendar date.
          On-time is delay ≤5 minutes among non-null delay values; cancellation
          share uses planned records as its denominator. Cell size shows all
          source rows.
        </div>
      </section>
    </>
  );
}

export function StationProfile({ eva }: { eva: string }) {
  const [profile, setProfile] = useState<Row | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/v1/stations/${encodeURIComponent(eva)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 404) {
          setMissing(true);
          return null;
        }
        if (!response.ok) throw new Error("Station profile request failed");
        return response.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          setMissing(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setMissing(true);
      });
    return () => controller.abort();
  }, [eva]);
  const hourly = (profile?.hourly as Row[] | undefined) || [];
  const categories = (profile?.categories as Row[] | undefined) || [];
  const rate =
    profile?.on_time_pct == null ? null : Number(profile.on_time_pct);
  return profile ? (
    <>
      <div className="profile-title panel">
        <div>
          <div className="panel-kicker">STATION INTELLIGENCE · EVA {eva}</div>
          <h2>{String(profile.name || "Unnamed station")}</h2>
          <p>
            Observed stop records from {String(profile.first_event)} through{" "}
            {String(profile.last_event)}. This profile describes the installed
            historical source only.
          </p>
        </div>
        <span className="profile-score">
          {fmt(rate)}
          {rate == null ? "" : "%"}
          <small>on time ≤5 min</small>
        </span>
      </div>
      <section className="metrics">
        <DataMetric
          label="OBSERVED EVENTS"
          value={fmt(Number(profile.events), 0)}
          note={`${fmt(Number(profile.timed_events), 0)} with reported delay`}
        />
        <DataMetric
          label="MEAN NON-NEGATIVE DELAY"
          value={
            profile.mean_nonnegative_delay == null
              ? "—"
              : `${fmt(Number(profile.mean_nonnegative_delay))} min`
          }
          note="Negative delays excluded"
        />
        <DataMetric
          label="P50 / P90 DELAY"
          value={`${fmt(profile.median_delay == null ? null : Number(profile.median_delay))} / ${fmt(profile.p90_delay == null ? null : Number(profile.p90_delay))} min`}
          note="All non-null source delay values"
        />
        <DataMetric
          label="PLANNED-RECORD CANCELLATION"
          value={
            profile.cancellation_pct == null
              ? "—"
              : `${fmt(Number(profile.cancellation_pct), 2)}%`
          }
          note={`${fmt(Number(profile.canceled), 0)} canceled of ${fmt(Number(profile.planned), 0)} planned rows`}
        />
      </section>
      <section className="panel analysis-panel">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">SOURCE LOCAL TIME</div>
            <h2>Hourly station pattern</h2>
          </div>
        </div>
        <div className="station-hourly">
          {hourly.map((row) => (
            <div
              className="station-hour"
              key={String(row.hour)}
              title={`${String(row.hour).padStart(2, "0")}:00 · ${fmt(Number(row.on_time_pct))}% on time`}
            >
              <span>{String(row.hour).padStart(2, "0")}</span>
              <i
                style={{
                  height: `${Math.max(3, Number(row.on_time_pct || 0))}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="analysis-note">
          Events are grouped by the hour in the source-local event timestamp.
          Hourly shares exclude rows with null delay.
        </div>
      </section>
      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <div className="panel-kicker">OBSERVED SOURCE TRAIN TYPES</div>
            <h2>Station category mix</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TYPE</th>
                <th>EVENTS</th>
                <th>ON TIME ≤5 MIN</th>
                <th>MEAN NON-NEGATIVE DELAY</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr key={String(row.category)}>
                  <td>{String(row.category)}</td>
                  <td className="mono">{fmt(Number(row.events), 0)}</td>
                  <td>{fmt(Number(row.on_time_pct))}%</td>
                  <td>
                    {row.mean_nonnegative_delay == null
                      ? "—"
                      : `${fmt(Number(row.mean_nonnegative_delay))} min`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  ) : (
    <section className="panel capability-panel">
      <div className="capability-body">
        <div>
          <strong>
            {missing
              ? "No station profile in the installed data"
              : "Loading station profile…"}
          </strong>
          <p>
            {missing
              ? `EVA ${eva} was not found in the local source files, or the analytics API is unavailable.`
              : "Reading the source observations for this EVA identifier."}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ComparisonWorkbench() {
  const [stations, setStations] = useState<Row[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [left, setLeft] = useState<Row | null>(null);
  const [right, setRight] = useState<Row | null>(null);
  useEffect(() => {
    fetch(`${API}/api/v1/stations?limit=1000`)
      .then((response) => response.json())
      .then((data) => {
        const items = data.items || [];
        setStations(items);
        setLeftId((current) => current || String(items[0]?.id || ""));
        setRightId((current) => current || String(items[1]?.id || ""));
      })
      .catch(() => setStations([]));
  }, []);
  useEffect(() => {
    if (!leftId || !rightId) return;
    const controller = new AbortController();
    Promise.all(
      [leftId, rightId].map((id) =>
        fetch(`${API}/api/v1/stations/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        }).then((response) => (response.ok ? response.json() : null)),
      ),
    )
      .then(([a, b]) => {
        setLeft(a);
        setRight(b);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLeft(null);
          setRight(null);
        }
      });
    return () => controller.abort();
  }, [leftId, rightId]);
  const renderProfile = (
    profile: Row | null,
    selectedId: string,
    change: (value: string) => void,
  ) => (
    <section className="panel comparison-card">
      <div className="panel-head">
        <select
          aria-label="Choose station"
          value={selectedId}
          onChange={(event) => change(event.target.value)}
        >
          {stations.map((station) => (
            <option key={String(station.id)} value={String(station.id)}>
              {String(station.name)} · EVA {String(station.id)}
            </option>
          ))}
        </select>
      </div>
      {profile ? (
        <div className="comparison-content">
          <span className="comparison-rate">
            {profile.on_time_pct == null
              ? "—"
              : `${fmt(Number(profile.on_time_pct))}%`}
          </span>
          <small>
            on time ≤5 min of {fmt(Number(profile.timed_events), 0)} timed
            events
          </small>
          <div className="comparison-stats">
            <div>
              <span>Mean non-negative delay</span>
              <b>
                {profile.mean_nonnegative_delay == null
                  ? "—"
                  : `${fmt(Number(profile.mean_nonnegative_delay))} min`}
              </b>
            </div>
            <div>
              <span>Cancellation share</span>
              <b>
                {profile.cancellation_pct == null
                  ? "—"
                  : `${fmt(Number(profile.cancellation_pct), 2)}%`}
              </b>
            </div>
            <div>
              <span>Observed event rows</span>
              <b>{fmt(Number(profile.events), 0)}</b>
            </div>
            <div>
              <span>Planned records</span>
              <b>{fmt(Number(profile.planned), 0)}</b>
            </div>
          </div>
          <div className="analysis-note">
            Station-specific observed window: {String(profile.first_event)} —{" "}
            {String(profile.last_event)}
          </div>
        </div>
      ) : (
        <div className="empty-row">
          Select a station with installed source observations.
        </div>
      )}
    </section>
  );
  return (
    <>
      <div className="comparison-pair">
        {renderProfile(left, leftId, setLeftId)}
        <div className="comparison-divider">VS</div>
        {renderProfile(right, rightId, setRightId)}
      </div>
      <div className="panel analysis-panel">
        <div className="analysis-note">
          Descriptive comparison of the installed source rows only. Station
          observation windows and sample sizes can differ; coverage differences
          and repeated observations are not adjusted. Values do not establish a
          statistically significant difference.
        </div>
      </div>
    </>
  );
}

function DataMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
