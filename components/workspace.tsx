"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleHelp,
  Clock3,
  Command,
  Download,
  GitBranch,
  Layers2,
  Map,
  Menu,
  Radio,
  Search,
  TrainFront,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ComparisonWorkbench,
  CoverageObservatory,
  DailyCalendar,
  DelayLaboratory,
  EventExplorer,
  StationProfile,
} from "./analytical-pages";

type Summary = {
  available: boolean;
  reason?: string;
  observations?: number;
  stations?: number;
  coverage?: { start: string; end: string };
  timed_events?: number;
  on_time_pct?: number | null;
  canceled?: number;
  planned?: number;
};
type Station = {
  id: string;
  name: string;
  events: number;
  mean_delay: number | null;
  on_time_pct: number | null;
  canceled: number;
  lat?: number | null;
  lon?: number | null;
};
type Hour = {
  hour: number;
  events: number;
  mean_delay: number | null;
  on_time_pct: number | null;
};
type DetailRow = Record<string, string | number | null>;
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const sections = [
  [
    "Workspace",
    [
      ["Network overview", "/"],
      ["Reliability atlas", "/atlas"],
      ["Historical replay", "/replay"],
    ],
  ],
  [
    "Performance",
    [
      ["Stations", "/stations"],
      ["Routes", "/routes"],
      ["Operators", "/operators"],
      ["Train categories", "/categories"],
    ],
  ],
  [
    "Analysis",
    [
      ["Delay laboratory", "/delays"],
      ["Cancellation observatory", "/cancellations"],
      ["Temporal explorer", "/temporal"],
      ["Comparison workbench", "/compare"],
      ["Rankings", "/rankings"],
    ],
  ],
  [
    "Transparency",
    [
      ["Data explorer", "/data"],
      ["Reports", "/reports"],
      ["Methodology", "/methodology"],
      ["Data coverage", "/coverage"],
      ["Settings", "/settings"],
    ],
  ],
] as const;
const titleFor = (path: string) =>
  path === "/"
    ? "Network overview"
    : path
        .split("/")
        .filter(Boolean)
        .map((s) =>
          s.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        )
        .join(" / ");
const number = (n?: number) =>
  n == null ? "—" : new Intl.NumberFormat("en").format(n);

export default function Workspace({ path }: { path: string }) {
  const [summary, setSummary] = useState<Summary>({ available: false });
  const [stations, setStations] = useState<Station[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
  const [search, setSearch] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [selected, setSelected] = useState<Station | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    fetch(`${API}/api/v1/summary`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() =>
        setSummary({
          available: false,
          reason: "The analytics API is unreachable.",
        }),
      );
    fetch(`${API}/api/v1/temporal/hourly`)
      .then((r) => r.json())
      .then((x) => setHours(x.items || []))
      .catch(() => setHours([]));
  }, [refresh]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("station-search")?.focus();
      }
      if (event.key === "Escape") {
        setMobileNav(false);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(
      () =>
        fetch(
          `${API}/api/v1/stations?limit=1000&q=${encodeURIComponent(search)}`,
          { signal: controller.signal },
        )
          .then((r) => r.json())
          .then((x) => setStations(x.items || []))
          .catch(() => {
            if (!controller.signal.aborted) setStations([]);
          }),
      200,
    );
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [search, refresh]);
  const pageTitle = titleFor(path);
  const plot = useMemo(() => (hours.length ? hours : []), [hours]);
  const geoStations = useMemo(
    () =>
      stations.filter(
        (s): s is Station & { lat: number; lon: number } =>
          s.lat != null && s.lon != null,
      ),
    [stations],
  );
  const detailMode =
    path === "/routes"
      ? "routes"
      : path === "/categories"
        ? "categories"
        : path === "/cancellations"
          ? "cancellations"
          : null;
  const detailEndpoint =
    detailMode === "routes"
      ? "/routes/segments"
      : detailMode === "categories"
        ? "/categories"
        : detailMode === "cancellations"
          ? "/cancellations/stations"
          : null;
  const limitation = capabilityLimit(path);
  useEffect(() => {
    if (!detailEndpoint) return;
    const controller = new AbortController();
    fetch(`${API}/api/v1${detailEndpoint}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((x) => setDetailRows(x.items || []))
      .catch(() => {
        if (!controller.signal.aborted) setDetailRows([]);
      });
    return () => controller.abort();
  }, [detailEndpoint, refresh]);
  const download = () => {
    const headers =
      detailMode === "routes"
        ? [
            "from_name",
            "to_name",
            "train_type",
            "line_number",
            "observed_runs",
            "paired_delay_runs",
            "mean_origin_nonnegative_delay",
            "mean_nonnegative_delay",
            "mean_delay_change",
          ]
        : detailMode === "categories"
          ? [
              "category",
              "events",
              "mean_delay",
              "on_time_pct",
              "planned",
              "canceled",
            ]
          : detailMode === "cancellations"
            ? ["id", "name", "planned", "canceled", "cancellation_pct"]
            : ["id", "name", "events", "mean_delay", "on_time_pct", "canceled"];
    const rows = detailMode ? detailRows : stations;
    if (!rows.length) return;
    const quote = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const body = rows.map((row) =>
      headers.map((key) => quote((row as DetailRow)[key])).join(","),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv" }),
    );
    a.download = `railway-intel-${detailMode || "stations"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32">
              <path d="M5 25 13 7h6l8 18M9 17h14M12 10h8" />
            </svg>
          </span>
          <span>
            <b>RAILWAY</b>
            <small>INTELLIGENCE</small>
          </span>
        </Link>
        <div className="side-label">ANALYTICAL WORKSPACE</div>
        <nav>
          {sections.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <div className="nav-heading">{group}</div>
              {items.map(([name, href]) => {
                const Icon =
                  href.includes("atlas") || href === "/"
                    ? Map
                    : href.includes("route")
                      ? GitBranch
                      : href.includes("temporal") || href.includes("replay")
                        ? Clock3
                        : href.includes("data") || href.includes("coverage")
                          ? Layers2
                          : href.includes("delay") || href.includes("rank")
                            ? BarChart3
                            : Activity;
                return (
                  <Link
                    key={href}
                    className={`nav-link ${path === href ? "active" : ""}`}
                    href={href}
                  >
                    <Icon size={15} />
                    <span>{name}</span>
                    {path === href && <i />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="source-mini">
            <span className={`dot ${summary.available ? "green" : ""}`} />
            <span>
              {summary.available
                ? "HISTORICAL DATA CONNECTED"
                : "DATA NOT INSTALLED"}
            </span>
          </div>
          <Link href="/methodology" className="help-link">
            <CircleHelp size={15} /> Source & methodology
          </Link>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu icon-btn"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Toggle navigation"
          >
            {mobileNav ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="crumb">
            <span>RAILWAY INTEL</span>
            <b>/</b>
            <strong>{pageTitle}</strong>
          </div>
          <div className="top-actions">
            <button
              className="command"
              onClick={() => document.getElementById("station-search")?.focus()}
            >
              <Search size={14} /> <span>Search stations…</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <button
              className="icon-btn"
              onClick={() => setRefresh(refresh + 1)}
              title="Refresh data"
            >
              <Radio size={16} />
            </button>
            <div className="status">
              <span className={`dot ${summary.available ? "green" : ""}`} />
              {summary.available ? "SOURCE LIVE" : "NO SOURCE"}
            </div>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {path === "/coverage"
                  ? "SOURCE TRANSPARENCY"
                  : path.startsWith("/stations/")
                    ? "STATION DETAIL"
                    : "GERMANY · HISTORICAL PERFORMANCE"}
              </div>
              <h1>{pageTitle}</h1>
              <p>
                {path === "/"
                  ? "Understand how the railway performs. Explore observed delays, cancellations and patterns across the network."
                  : `${pageTitle} · Explore observed historical railway performance with clear source coverage and limits.`}
              </p>
            </div>
            <div className="heading-actions">
              {[
                "/",
                "/stations",
                "/routes",
                "/categories",
                "/cancellations",
                "/rankings",
              ].includes(path) && (
                <button className="outline-btn" onClick={download}>
                  <Download size={14} /> Export CSV
                </button>
              )}
            </div>
          </div>
          {!summary.available && (
            <div className="notice">
              <div className="notice-icon">
                <Layers2 size={18} />
              </div>
              <div>
                <strong>Historical dataset not installed</strong>
                <p>
                  {summary.reason ||
                    "No railway observations are present in the local analytical store. No performance values are being estimated or simulated."}{" "}
                  Start with <code>make data-discover</code> and{" "}
                  <code>make data-bootstrap</code> to install a real monthly
                  source file.
                </p>
                <Link href="/coverage">
                  View source coverage and limitations <span>→</span>
                </Link>
              </div>
              <button
                className="icon-btn"
                onClick={() => setRefresh(refresh + 1)}
                aria-label="Retry"
              >
                ↻
              </button>
            </div>
          )}
          {limitation ? (
            <CapabilityPanel title={pageTitle} text={limitation} />
          ) : path.startsWith("/stations/") ? (
            <StationProfile eva={path.split("/")[2] || ""} />
          ) : path === "/compare" ? (
            <ComparisonWorkbench />
          ) : path === "/delays" ? (
            <DelayLaboratory />
          ) : path === "/data" ? (
            <EventExplorer />
          ) : path === "/coverage" ? (
            <CoverageObservatory />
          ) : path === "/temporal" ? (
            <DailyCalendar />
          ) : (
            <>
              <div className="metrics">
                <Metric
                  label="OBSERVED STOP EVENTS"
                  value={number(summary.observations)}
                  detail={
                    summary.coverage
                      ? `${summary.coverage.start.slice(0, 10)} — ${summary.coverage.end.slice(0, 10)}`
                      : "Awaiting local source"
                  }
                  icon={<Activity size={15} />}
                />
                <Metric
                  label="STATIONS IN SOURCE"
                  value={number(summary.stations)}
                  detail="Distinct EVA station identifiers"
                  icon={<Map size={15} />}
                />
                <Metric
                  label="ON TIME ≤ 5 MIN"
                  value={
                    summary.on_time_pct == null
                      ? "—"
                      : `${summary.on_time_pct}%`
                  }
                  detail="Of events with reported delay"
                  icon={<Clock3 size={15} />}
                />
                <Metric
                  label="CANCELED EVENTS"
                  value={number(summary.canceled)}
                  detail={`of ${number(summary.planned)} planned records`}
                  icon={<TrainFront size={15} />}
                />
              </div>
              {!detailMode && (
                <div className="workspace-grid">
                  <section className="panel map-panel">
                    <div className="panel-head">
                      <div>
                        <div className="panel-kicker">NETWORK INTELLIGENCE</div>
                        <h2>Observed performance field</h2>
                      </div>
                      <Link className="quiet-btn" href="/atlas">
                        Open atlas <span>↗</span>
                      </Link>
                    </div>
                    <div className="map-field">
                      <div className="map-grid" />
                      {geoStations.length > 0 ? (
                        <>
                          <svg
                            className="germany-outline"
                            viewBox="0 0 270 325"
                          >
                            <path d="M 121.2,17.9 L 121.7,32.5 L 148.1,41.4 L 147.8,54.8 L 174.4,47.7 L 189.1,37.3 L 218.6,52.3 L 230.9,64.3 L 237.0,83.6 L 229.8,93.7 L 239.3,107.2 L 245.7,127.5 L 243.7,140.5 L 254.4,164.7 L 242.7,168.7 L 235.8,164.3 L 229.3,171.5 L 210.5,178.9 L 200.8,188.3 L 181.8,196.5 L 186.4,207.8 L 189.1,223.8 L 202.5,232.9 L 217.2,249.1 L 208.0,266.6 L 198.6,271.4 L 202.3,296.1 L 199.9,302.5 L 191.8,294.8 L 179.2,293.6 L 160.5,300.4 L 137.5,298.8 L 133.7,308.8 L 120.5,298.3 L 112.6,300.3 L 84.6,288.8 L 79.2,297.0 L 57.0,296.7 L 60.3,269.7 L 73.5,243.8 L 35.9,236.8 L 23.5,226.9 L 25.0,210.3 L 19.8,201.8 L 22.8,176.2 L 18.4,136.5 L 34.1,136.5 L 40.7,122.2 L 47.2,87.6 L 42.3,74.8 L 47.4,66.7 L 69.3,64.7 L 74.1,73.0 L 91.9,54.4 L 85.9,40.2 L 84.7,18.7 L 104.5,23.7 L 121.2,17.9 Z" />
                            {geoStations.map((s) => {
                              const x =
                                ((s.lon - 5.86) / (15.04 - 5.86)) * 240 + 15;
                              const y =
                                (1 - (s.lat - 47.27) / (55.06 - 47.27)) *
                                  295 +
                                15;
                              const rate = s.on_time_pct ?? 80;
                              const color =
                                rate >= 80
                                  ? "#36cfa0"
                                  : rate >= 70
                                    ? "#e8c45c"
                                    : rate >= 60
                                      ? "#f28b39"
                                      : "#f05262";
                              const radius = Math.min(
                                5,
                                Math.max(2, Math.log10(s.events || 10) * 1.2),
                              );
                              return (
                                <g
                                  key={s.id}
                                  className="map-node"
                                  onClick={() => setSelected(s)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={radius + 2.5}
                                    fill={color}
                                    opacity="0.25"
                                  />
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={radius}
                                    fill={color}
                                    stroke="#0c141c"
                                    strokeWidth="0.8"
                                  />
                                  <title>{`${s.name} (EVA ${s.id})\nOn-time: ${s.on_time_pct ?? "—"}%\nMean delay: ${s.mean_delay ?? "—"} min\nEvents: ${s.events.toLocaleString()}`}</title>
                                </g>
                              );
                            })}
                          </svg>
                          <div className="map-scale">
                            <span>ON-TIME SHARE</span>
                            <i />
                            <small>&lt;60%</small>
                            <small>&ge;80%</small>
                          </div>
                          <div className="map-zoom">
                            <button aria-label="Zoom in">+</button>
                            <button aria-label="Zoom out">−</button>
                          </div>
                          <div className="map-coords">
                            51.1657° N, 10.4515° E
                            <span>EPSG:4326 · {geoStations.length} NODES</span>
                          </div>
                        </>
                      ) : (
                        <div className="map-unavailable">
                          <span className="map-pin">
                            <Map size={18} />
                          </span>
                          <b>
                            {summary.available
                              ? "Loading station coordinates…"
                              : "Awaiting source data"}
                          </b>
                          <span>
                            {summary.available
                              ? "Reading geographic positions for observed stations."
                              : "Install a monthly dataset to populate the network map."}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="map-foot">
                      <span>
                        {geoStations.length > 0
                          ? `${geoStations.length} observed stations mapped across Germany`
                          : "Geographic markers are unavailable until station coordinates are ingested."}
                      </span>
                      {geoStations.length > 0 && (
                        <small>Color: punctuality · Size: observations</small>
                      )}
                    </div>
                  </section>
                  <section className="panel temporal-panel">
                    <div className="panel-head">
                      <div>
                        <div className="panel-kicker">
                          TIME OF DAY · SOURCE LOCAL TIME
                        </div>
                        <h2>Delay profile</h2>
                      </div>
                      <button className="icon-btn" title="Profile details">
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    {plot.length > 0 ? (
                      <div className="chart-wrap">
                        <div className="chart-y">
                          <span>20m</span>
                          <span>10m</span>
                          <span>0m</span>
                        </div>
                        <div className="chart">
                          <div className="chart-grid">
                            <i />
                            <i />
                            <i />
                          </div>
                          <svg viewBox="0 0 600 190" preserveAspectRatio="none">
                            <defs>
                              <linearGradient
                                id="fill"
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#38bdf8"
                                  stopOpacity=".2"
                                />
                                <stop
                                  offset="1"
                                  stopColor="#38bdf8"
                                  stopOpacity="0"
                                />
                              </linearGradient>
                            </defs>
                            <polygon
                              points={`0,190 ${plot.map((d, i) => `${(i * 600) / Math.max(plot.length - 1, 1)},${190 - Math.min((d.mean_delay || 0) * 9.5, 180)}`).join(" ")} 600,190`}
                              fill="url(#fill)"
                            />
                            <polyline
                              points={plot
                                .map(
                                  (d, i) =>
                                    `${(i * 600) / Math.max(plot.length - 1, 1)},${190 - Math.min((d.mean_delay || 0) * 9.5, 180)}`,
                                )
                                .join(" ")}
                              fill="none"
                              stroke="#38bdf8"
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                          <div className="chart-x">
                            {[0, 6, 12, 18, 23].map((x) => (
                              <span key={x}>
                                {String(x).padStart(2, "0")}:00
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyChart text="Hourly delay profile appears after historical observations are ingested." />
                    )}
                    <div className="chart-legend">
                      <span>
                        <i className="legend-line" />
                        Mean non-negative delay
                      </span>
                      <small>Aggregated by event hour · local time</small>
                    </div>
                  </section>
                </div>
              )}
              <section className="panel table-panel">
                <div className="panel-head table-head">
                  <div>
                    <div className="panel-kicker">
                      {detailMode === "routes"
                        ? "OBSERVED CONSECUTIVE STOP PAIRS"
                        : detailMode === "categories"
                          ? "SOURCE TRAIN CATEGORIES"
                          : detailMode === "cancellations"
                            ? "CANCELLATIONS · PLANNED EVENT DENOMINATOR"
                            : "STATION INTELLIGENCE"}
                    </div>
                    <h2>
                      {detailMode === "routes"
                        ? "Route segment reliability"
                        : detailMode === "categories"
                          ? "Reliability by train category"
                          : detailMode === "cancellations"
                            ? "Stations with highest planned-event cancellation rate"
                            : path === "/stations"
                              ? "Station directory"
                              : "Stations with highest observed mean delay"}
                    </h2>
                  </div>
                  <div className="table-tools">
                    {!detailMode && (
                      <>
                        <div className="search-input">
                          <Search size={14} />
                          <input
                            id="station-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Filter stations"
                          />
                        </div>
                        <Link className="quiet-btn" href="/stations">
                          Full directory <span>→</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      {detailMode === "routes" ? (
                        <tr>
                          <th>FROM</th>
                          <th>TO</th>
                          <th>TRAIN TYPE</th>
                          <th>LINE</th>
                          <th>OBSERVED RUNS</th>
                          <th>PAIRED DELAYS</th>
                          <th>ORIGIN MEAN</th>
                          <th>DESTINATION MEAN</th>
                          <th>MEAN CHANGE</th>
                        </tr>
                      ) : detailMode === "categories" ? (
                        <tr>
                          <th>TRAIN TYPE</th>
                          <th>OBSERVATIONS</th>
                          <th>MEAN NON-NEGATIVE DELAY</th>
                          <th>ON TIME ≤5 MIN</th>
                          <th>PLANNED</th>
                          <th>CANCELED</th>
                        </tr>
                      ) : detailMode === "cancellations" ? (
                        <tr>
                          <th>RANK</th>
                          <th>STATION</th>
                          <th>PLANNED EVENTS</th>
                          <th>CANCELED EVENTS</th>
                          <th>CANCELLATION RATE</th>
                        </tr>
                      ) : (
                        <tr>
                          <th>RANK</th>
                          <th>STATION</th>
                          <th>OBSERVATIONS</th>
                          <th>MEAN NON-NEGATIVE DELAY</th>
                          <th>ON TIME ≤5 MIN</th>
                          <th>CANCELED</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {detailMode === "routes" ? (
                        detailRows.map((r, i) => (
                          <tr
                            key={`${r.from_id}-${r.to_id}-${r.train_type}-${r.line_number}-${i}`}
                          >
                            <td>{r.from_name || r.from_id}</td>
                            <td>{r.to_name || r.to_id}</td>
                            <td>{r.train_type || "Unspecified"}</td>
                            <td>{r.line_number || "—"}</td>
                            <td className="mono">
                              {number(Number(r.observed_runs))}
                            </td>
                            <td className="mono">
                              {number(Number(r.paired_delay_runs))}
                            </td>
                            <td>
                              {r.mean_origin_nonnegative_delay == null
                                ? "—"
                                : `${Number(r.mean_origin_nonnegative_delay).toFixed(1)} min`}
                            </td>
                            <td className="delay-val">
                              {r.mean_nonnegative_delay == null
                                ? "—"
                                : `${Number(r.mean_nonnegative_delay).toFixed(1)} min`}
                            </td>
                            <td
                              className={
                                Number(r.mean_delay_change) > 0
                                  ? "cancel-value"
                                  : "delay-val"
                              }
                            >
                              {r.mean_delay_change == null
                                ? "—"
                                : `${Number(r.mean_delay_change) > 0 ? "+" : ""}${Number(r.mean_delay_change).toFixed(1)} min`}
                            </td>
                          </tr>
                        ))
                      ) : detailMode === "categories" ? (
                        detailRows.map((r, i) => (
                          <tr key={`${r.category}-${i}`}>
                            <td className="station-name">{r.category}</td>
                            <td className="mono">{number(Number(r.events))}</td>
                            <td className="delay-val">
                              {r.mean_delay == null
                                ? "—"
                                : `${Number(r.mean_delay).toFixed(1)} min`}
                            </td>
                            <td>
                              {r.on_time_pct == null
                                ? "—"
                                : `${r.on_time_pct}%`}
                            </td>
                            <td className="mono">
                              {number(Number(r.planned))}
                            </td>
                            <td className="mono cancel-value">
                              {number(Number(r.canceled))}
                            </td>
                          </tr>
                        ))
                      ) : detailMode === "cancellations" ? (
                        detailRows.map((r, i) => (
                          <tr key={`${r.id}-${i}`}>
                            <td className="rank">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td>
                              <span className="station-name">{r.name}</span>
                              <span className="station-code">EVA {r.id}</span>
                            </td>
                            <td className="mono">
                              {number(Number(r.planned))}
                            </td>
                            <td className="mono cancel-value">
                              {number(Number(r.canceled))}
                            </td>
                            <td className="delay-val">
                              {r.cancellation_pct == null
                                ? "—"
                                : `${Number(r.cancellation_pct).toFixed(2)}%`}
                            </td>
                          </tr>
                        ))
                      ) : stations.length ? (
                        (path === "/stations"
                          ? stations
                          : stations.slice(0, 8)
                        ).map((s, i) => (
                          <tr
                            key={s.id}
                            onClick={() => setSelected(s)}
                            className="data-row"
                          >
                            <td className="rank">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td>
                              <span className="station-name">
                                {s.name || "Unnamed station"}
                              </span>
                              <span className="station-code">EVA {s.id}</span>
                            </td>
                            <td className="mono">{number(s.events)}</td>
                            <td>
                              <span className="delay-val">
                                {s.mean_delay == null
                                  ? "—"
                                  : `${s.mean_delay.toFixed(1)} min`}
                              </span>
                            </td>
                            <td>
                              <div className="reliability">
                                <span>
                                  {s.on_time_pct == null
                                    ? "—"
                                    : `${s.on_time_pct}%`}
                                </span>
                                <div>
                                  <i
                                    style={{
                                      width: `${Math.max(0, Math.min(s.on_time_pct || 0, 100))}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="mono cancel-value">
                              {number(s.canceled)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="empty-row">
                            {summary.available
                              ? "No matching stations in this dataset."
                              : "Station rankings are unavailable until a real source file has been installed."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-foot">
                  <span>
                    {detailMode === "routes"
                      ? "Pairs follow source train-run stop order. Origin and destination means use non-negative reported delays; mean change uses only runs with delay at both stops. Negative change indicates observed recovery, not a verified cause."
                      : detailMode === "categories"
                        ? "Source train_type only; null category rows are excluded."
                        : detailMode === "cancellations"
                          ? "Canceled planned records divided by source rows with a plan record. Minimum 20 planned events per station."
                          : "Only stations with at least 20 source events · ranking uses mean non-negative delay"}
                  </span>
                  <span>
                    {detailMode
                      ? `${detailRows.length} result rows`
                      : stations.length
                        ? `Showing ${path === "/stations" ? stations.length : Math.min(8, stations.length)} of ${stations.length}`
                        : "No records"}{" "}
                    <ArrowDownRight size={13} />
                  </span>
                </div>
              </section>
              <footer>
                <span>
                  RAILWAY INTEL <i /> HISTORICAL RAIL PERFORMANCE
                </span>
                <span>
                  Independent analysis · Not affiliated with Deutsche Bahn
                </span>
                <Link href="/methodology">Methodology & attribution</Link>
              </footer>
            </>
          )}
        </div>
        {selected && (
          <div className="drawer-wrap" onClick={() => setSelected(null)}>
            <section className="drawer" onClick={(e) => e.stopPropagation()}>
              <button
                className="icon-btn drawer-close"
                onClick={() => setSelected(null)}
                aria-label="Close station details"
              >
                <X size={18} />
              </button>
              <div className="panel-kicker">
                STATION PROFILE · EVA {selected.id}
              </div>
              <h2>{selected.name}</h2>
              <p>
                Metrics reflect only the observations included in the currently
                installed source files.
              </p>
              <Metric
                label="OBSERVATIONS"
                value={number(selected.events)}
                detail="Recorded stop events"
                icon={<Activity size={15} />}
              />
              <Metric
                label="MEAN NON-NEGATIVE DELAY"
                value={
                  selected.mean_delay == null
                    ? "—"
                    : `${selected.mean_delay.toFixed(1)} min`
                }
                detail="Negative values excluded"
                icon={<Clock3 size={15} />}
              />
              <Metric
                label="ON TIME ≤5 MIN"
                value={
                  selected.on_time_pct == null
                    ? "—"
                    : `${selected.on_time_pct}%`
                }
                detail="Events with reported delay"
                icon={<ArrowUpRight size={15} />}
              />
              <Metric
                label="CANCELED"
                value={number(selected.canceled)}
                detail="Arrival or departure flag set"
                icon={<TrainFront size={15} />}
              />
              <Link className="outline-btn" href={`/stations/${selected.id}`}>
                Open station analysis →
              </Link>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <i>{icon}</i>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function EmptyChart({ text }: { text: string }) {
  return (
    <div className="empty-chart">
      <div className="empty-chart-icon">
        <BarChart3 size={20} />
      </div>
      <span>{text}</span>
    </div>
  );
}
function capabilityLimit(path: string): string | null {
  if (
    path === "/" ||
    path === "/stations" ||
    path === "/rankings" ||
    path === "/temporal" ||
    path === "/routes" ||
    path === "/categories" ||
    path === "/cancellations" ||
    path === "/delays" ||
    path === "/data" ||
    path === "/coverage" ||
    path === "/compare" ||
    path === "/atlas"
  )
    return null;
  if (path.startsWith("/stations/")) return null;
  if (path === "/operators" || path.startsWith("/operators/"))
    return "The processed monthly stop file used by this workspace does not include train_owner. Operator attribution is present in separate parsed snapshots, which are not yet ingested, so operator rankings are withheld.";
  if (path.startsWith("/routes/"))
    return "The selected route segment can be inspected in the source segment table, but a route detail profile and its full journey history have not been built yet.";
  if (path === "/replay")
    return "The source records observed event times, not complete synchronized network snapshots. Without snapshot provenance and station coordinates, a spatial historical replay would overstate what the feed records.";
  if (path === "/reports")
    return "CSV export is available for station, route-segment, category, and cancellation tables. Reproducible multi-panel reports are not yet implemented.";
  if (path === "/methodology")
    return "The current metric definitions, source limitations, and timestamp handling are documented in METHODOLOGY.md and DATA_SOURCES.md.";
  if (path === "/settings")
    return "The application currently has no user settings beyond the system dark analytical theme. Persistent preferences are not yet implemented.";
  return "This analysis is not available for the installed dataset. The workspace does not generate substitute performance values.";
}
function CapabilityPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel capability-panel">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">DATA CAPABILITY</div>
          <h2>{title}</h2>
        </div>
        <Layers2 size={17} />
      </div>
      <div className="capability-body">
        <div className="capability-mark">
          <CircleHelp size={19} />
        </div>
        <div>
          <strong>Analysis unavailable in this workspace build</strong>
          <p>{text}</p>
          <Link href="/methodology">
            Review methodology and source limits →
          </Link>
        </div>
      </div>
    </section>
  );
}
