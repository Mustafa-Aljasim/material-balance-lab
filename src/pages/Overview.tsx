import { historyLabel, historyAxisTitle } from "../engineering/observation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleCheck,
  Droplets,
  Gauge,
  Layers3,
  MoveRight,
} from "lucide-react";
import type { Data } from "plotly.js";
import type { Scenario, SolvedRow } from "../types";
import { Chart, colors } from "../charts/Chart";
import { fromField, reservoirUnit, unit } from "../engineering/units";
import {
  metrics,
  originSlope,
  pzValidity,
  linearFit,
} from "../engineering/diagnostics";
export const fmt = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString(undefined, {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
export function PressureCharts({
  s,
  rows,
  inspect,
  cumulative = false,
}: {
  s: Scenario;
  rows: SolvedRow[];
  inspect: (id: string) => void;
  cumulative?: boolean;
}) {
  const scale = s.model === "oil" ? 1e6 : 1e9,
    q = s.model === "oil" ? "liquid" : "gas";
  const x = (r: SolvedRow) =>
    cumulative
      ? fromField(s.model === "oil" ? r.row.np : r.row.gp, q, s.units) / scale
      : historyLabel(r.row);
  const data: Data[] = [
    {
      type: "scatter",
      mode: "lines",
      name: "Calculated pressure",
      x: rows.map(x),
      y: rows.map((r) =>
        r.predicted === null
          ? null
          : fromField(r.predicted, "pressure", s.units),
      ),
      customdata: rows.map((r) => `predicted:${r.row.id}`),
      line: { color: colors.green, width: 2.5 },
      connectgaps: false,
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Active surveys",
      x: rows.filter((r) => r.row.use).map(x),
      y: rows
        .filter((r) => r.row.use)
        .map((r) =>
          r.row.pressure === null
            ? null
            : fromField(r.row.pressure, "pressure", s.units),
        ),
      customdata: rows.filter((r) => r.row.use).map((r) => r.row.id),
      marker: {
        color: colors.orange,
        size: 8,
        line: { color: "#fff", width: 1.5 },
      },
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Excluded surveys",
      x: rows.filter((r) => !r.row.use).map(x),
      y: rows
        .filter((r) => !r.row.use)
        .map((r) =>
          r.row.pressure === null
            ? null
            : fromField(r.row.pressure, "pressure", s.units),
        ),
      customdata: rows.filter((r) => !r.row.use).map((r) => r.row.id),
      marker: { color: colors.gray, symbol: "circle-open", size: 8 },
    },
  ];
  return (
    <Chart
      title={
        cumulative
          ? "Pressure vs cumulative production"
          : "Reservoir pressure history"
      }
      subtitle="Independent forward solution · measured surveys for comparison"
      data={data}
      xTitle={
        cumulative
          ? `${s.model === "oil" ? "Np" : "Gp"} (${scale === 1e6 ? "MM" : "B"} ${unit(q, s.units)})`
          : historyAxisTitle(s.history)
      }
      yTitle={`Pressure (${unit("pressure", s.units)})`}
      onPoint={inspect}
      height={350}
    />
  );
}
export function DiagnosticCharts({
  s,
  rows,
  inspect,
  compact = false,
}: {
  s: Scenario;
  rows: SolvedRow[];
  inspect: (id: string) => void;
  compact?: boolean;
}) {
  const active = rows.filter((r) => r.row.use && r.measured),
    b = active.map((r) => r.measured!);
  const corrected = s.display.corrected;
  const vol = (v: number) => fromField(v, "liquid", s.units);
  const gas = (v: number) => fromField(v, "gas", s.units);
  const why = s.model === "gas" ? pzValidity(s, rows) : [];
  const scatter = (x: number[], y: (number | null)[], name: string): Data => ({
    type: "scatter",
    mode: "markers",
    x,
    y,
    name,
    customdata: active.map((r) => r.row.id),
    text: active.map(
      (r) =>
        `${historyLabel(r.row)}<br>p = ${fmt(fromField(r.measured!.p, "pressure", s.units))} ${unit("pressure", s.units)}<br>F = ${fmt(vol(r.measured!.F))} ${reservoirUnit(s.units)}<br>Et = ${r.measured!.Et.toPrecision(6)} ${s.model === "oil" ? "rb/STB" : "rb/scf"}<br>We = ${fmt(vol(r.measured!.We))} ${reservoirUnit(s.units)}`,
    ),
    hovertemplate:
      "%{text}<br>x = %{x:.5g}<br>y = %{y:.5g}<extra>%{fullData.name}</extra>",
    marker: { color: colors.orange, size: 7 },
  });
  if (s.model === "oil") {
    const end = Math.max(0.001, ...b.map((v) => v.Et)) * 1.05;
    const slope = originSlope(
      b
        .filter((v) => Math.abs(v.Et) > 1e-10)
        .map((v) => [v.Et, v.F - (corrected ? v.We : 0)]),
    );
    return (
      <div className={compact ? "" : "chart-grid"}>
        <div>
          <Chart
            title="Havlena–Odeh"
            subtitle={`${corrected ? "Aquifer-corrected withdrawal" : "Net underground withdrawal"} vs total expansion`}
            data={[
              scatter(
                b.map((v) => v.Et),
                b.map((v) => vol(v.F - (corrected ? v.We : 0)) / 1e6),
                "Selected surveys",
              ),
              {
                type: "scatter",
                mode: "lines",
                name: "Entered OOIP model",
                x: [0, end],
                y: [0, vol(s.params.N * end) / 1e6],
                line: { color: colors.green, width: 2 },
              },
              ...(slope === null
                ? []
                : [
                    {
                      type: "scatter",
                      mode: "lines",
                      name: "Origin-constrained fit",
                      x: [0, end],
                      y: [0, vol(slope * end) / 1e6],
                      line: { color: colors.blue, dash: "dot" },
                    } as Data,
                  ]),
            ]}
            xTitle="Total expansion · Et (rb/STB = rm³/sm³)"
            yTitle={`${corrected ? "F − We" : "F"} (MM ${reservoirUnit(s.units)})`}
            onPoint={inspect}
            height={compact ? 280 : 330}
          />
          {!compact && (
            <p className="interpretation">
              Origin-constrained fit:{" "}
              {fmt(slope === null ? null : vol(slope) / 1e6, 2)} MM{" "}
              {unit("liquid", s.units)} ·{" "}
              {b.filter((v) => Math.abs(v.Et) > 1e-10).length} active
              nonzero-expansion surveys. Slope represents N only if the
              expansion model is appropriate and influx is removed or
              negligible.
            </p>
          )}
        </div>
        {!compact && (
          <div>
            <Chart
              title="Campbell diagnostic"
              subtitle="Apparent oil in place through depletion"
              data={[
                scatter(
                  b.map((v) => vol(v.F) / 1e6),
                  b.map((v) =>
                    Math.abs(v.Et) > 1e-10
                      ? vol((v.F - (corrected ? v.We : 0)) / v.Et) / 1e6
                      : null,
                  ),
                  corrected ? "(F − We) / Et" : "F / Et",
                ),
                {
                  type: "scatter",
                  mode: "lines",
                  name: "Entered OOIP",
                  x: [0, Math.max(1, ...b.map((v) => vol(v.F) / 1e6))],
                  y: [vol(s.params.N) / 1e6, vol(s.params.N) / 1e6],
                  line: { color: colors.green, dash: "dash" },
                },
              ]}
              xTitle={`Net withdrawal · F (MM ${reservoirUnit(s.units)})`}
              yTitle={`Apparent N (MM ${unit("liquid", s.units)})`}
              onPoint={inspect}
            />
            <p className="interpretation">
              A plateau supports a consistent tank estimate. A rise can reflect
              unaccounted support. Scatter may reflect pressure, production or
              PVT uncertainty. No shape uniquely identifies a drive mechanism.
            </p>
          </div>
        )}
      </div>
    );
  }
  const initial = b[0]?.initial;
  const pzi = initial ? s.params.pi / initial.z! : 0,
    fit = linearFit(
      active.map((r) => [r.row.gp, r.measured!.p / r.measured!.pvt.z!]),
    );
  const endG =
    s.display.extrapolatePz && !why.length
      ? Math.max(s.params.G, fit?.interceptX ?? 0)
      : Math.max(1, ...active.map((r) => r.row.gp));
  const pzData: Data[] = [
    scatter(
      active.map((r) => gas(r.row.gp) / 1e9),
      b.map((v) => fromField(v.p / v.pvt.z!, "pressure", s.units)),
      "Selected p/Z surveys",
    ),
  ];
  if (!why.length)
    pzData.push({
      type: "scatter",
      mode: "lines",
      name: "Volumetric OGIP model",
      x: [0, gas(endG) / 1e9],
      y: [
        fromField(pzi, "pressure", s.units),
        fromField(pzi * (1 - endG / s.params.G), "pressure", s.units),
      ],
      line: { color: colors.green, width: 2 },
    });
  if (!why.length && fit)
    pzData.push({
      type: "scatter",
      mode: "lines",
      name: "Survey regression",
      x: [0, gas(endG) / 1e9],
      y: [
        fromField(fit.intercept, "pressure", s.units),
        fromField(fit.intercept + fit.slope * endG, "pressure", s.units),
      ],
      line: { color: colors.blue, dash: "dot" },
    });
  return (
    <div className={compact ? "" : "chart-grid"}>
      <div>
        <Chart
          title="p/Z depletion diagnostic"
          subtitle={
            why.length
              ? `Straight-line interpretation disabled: ${why.join(", ")}`
              : "Constant-temperature, volumetric gas balance"
          }
          data={pzData}
          xTitle={`Cumulative gas · Gp (B ${unit("gas", s.units)})`}
          yTitle={`p/Z (${unit("pressure", s.units)})`}
          onPoint={inspect}
          height={compact ? 280 : 330}
        />
        {!compact && (
          <p className="interpretation">
            {why.length
              ? "Nonvolumetric case: no straight-line OGIP interpretation is shown."
              : `Unconstrained regression uses ${active.length} active surveys. Extrapolated OGIP: ${fmt(fit?.interceptX ? gas(fit.interceptX) / 1e9 : null, 2)} B ${unit("gas", s.units)}.`}{" "}
            Curvature can reflect water influx, data issues or violated
            assumptions.
          </p>
        )}
      </div>
      {!compact && (
        <div>
          <Chart
            title="Cole diagnostic"
            subtitle="Gas and pore-volume expansion included in Et"
            data={[
              scatter(
                active.map((r) => gas(r.row.gp) / 1e9),
                b.map((v) =>
                  Math.abs(v.Et) > 1e-12
                    ? gas((v.F - (corrected ? v.We : 0)) / v.Et) / 1e9
                    : null,
                ),
                corrected ? "(F − We) / Et" : "F / Et",
              ),
              {
                type: "scatter",
                mode: "lines",
                name: "Entered OGIP",
                x: [0, gas(endG) / 1e9],
                y: [gas(s.params.G) / 1e9, gas(s.params.G) / 1e9],
                line: { color: colors.green, dash: "dash" },
              },
            ]}
            xTitle={`Cumulative gas · Gp (B ${unit("gas", s.units)})`}
            yTitle={`Apparent G (B ${unit("gas", s.units)})`}
            onPoint={inspect}
          />
          <p className="interpretation">
            A consistent aquifer-corrected F/Et approaches entered G. Et = Bg −
            Bgi + Efw, in rb/scf internally. Near-zero expansion points are
            omitted. Trends are diagnostic, not unique proof of water drive.
          </p>
        </div>
      )}
    </div>
  );
}
export function Overview({
  s,
  rows,
  inspect,
  setTab,
}: {
  s: Scenario;
  rows: SolvedRow[];
  inspect: (id: string) => void;
  setTab: (t: string) => void;
}) {
  const last = rows.at(-1),
    met = metrics(rows),
    oil = s.model === "oil",
    q = oil ? "liquid" : "gas",
    scale = oil ? 1e6 : 1e9;
  const pressure = last?.predicted,
    recovery = last
      ? (oil ? last.row.np / s.params.N : last.row.gp / s.params.G) * 100
      : 0;
  return (
    <>
      <div className="welcome-strip">
        <div>
          <span className="eyebrow">A CLEARER VIEW OF YOUR RESERVOIR</span>
          <h2>
            From production history
            <br />
            to reservoir understanding<span>.</span>
          </h2>
          <p>Connect pressure, fluids and recovery in one material balance.</p>
          <button onClick={() => setTab("Material Balance")}>
            Explore the balance <MoveRight size={15} />
          </button>
        </div>
        <div className="tank-graphic" aria-label="Conceptual reservoir tank">
          <span className="tank-label">0D RESERVOIR MODEL</span>
          <svg
            viewBox="0 0 260 160"
            role="img"
            aria-label="Layered tank illustration"
          >
            <defs>
              <pattern
                id="rock"
                width="13"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <path d="M0 7h13M6 0v7" stroke="#6b8063" strokeWidth=".65" />
              </pattern>
            </defs>
            <path d="M25 59 130 12l106 47-106 49Z" fill="#6f8b6d" />
            <path d="m25 59 105 49 106-49v25l-106 49L25 84Z" fill="#405f4e" />
            <path d="m25 84 105 49 106-49v18l-106 49L25 102Z" fill="#ceaa6e" />
            <path d="m25 102 105 49 106-49v14l-106 42L25 116Z" fill="#718f8b" />
            <path
              d="M130 108v50M25 59 130 12l106 47-106 49Z"
              fill="url(#rock)"
              stroke="#b6c2a4"
              strokeWidth=".8"
            />
            <path
              d="M173 65V9h-23v23"
              fill="none"
              stroke="#dfc58d"
              strokeWidth="3"
            />
            <circle cx="173" cy="65" r="4" fill="#ead8aa" />
            <path d="M173 9h27" stroke="#dfc58d" strokeWidth="3" />
          </svg>
          <div className="tank-legend">
            <span>
              <i style={{ background: "#405f4e" }} />
              Hydrocarbons
            </span>
            <span>
              <i style={{ background: "#718f8b" }} />
              Connate water
            </span>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <h2>Reservoir at a glance</h2>
        <span>
          <span className="tiny-dot" /> Live model response
        </span>
      </div>
      <div className="stats-grid">
        <Stat
          icon={<Layers3 size={18} />}
          label={oil ? "Original oil in place" : "Original gas in place"}
          value={fmt(
            fromField(oil ? s.params.N : s.params.G, q, s.units) / scale,
            2,
          )}
          units={`${oil ? "MM" : "B"} ${unit(q, s.units)}`}
          note="Entered tank volume"
        />
        <Stat
          icon={<Gauge size={18} />}
          label="Latest calculated pressure"
          value={fmt(
            pressure == null ? null : fromField(pressure, "pressure", s.units),
            s.units === "FIELD" ? 0 : 2,
          )}
          units={unit("pressure", s.units)}
          note={
            pressure == null
              ? "No valid pressure solution"
              : `${fmt((1 - pressure / s.params.pi) * 100)}% below initial`
          }
          arrow
        />
        <Stat
          icon={<Droplets size={18} />}
          label="Cumulative recovery"
          value={fmt(recovery)}
          units="%"
          note={`Produced / entered ${oil ? "OOIP" : "OGIP"}`}
        />
        <Stat
          icon={<Activity size={18} />}
          label="Pressure match · RMSE"
          value={fmt(
            met.rmse == null ? null : fromField(met.rmse, "pressure", s.units),
            s.units === "FIELD" ? 2 : 4,
          )}
          units={unit("pressure", s.units)}
          note={`${met.solved} of ${met.count} active surveys solved`}
        />
      </div>
      <div className="main-chart-grid">
        <PressureCharts s={s} rows={rows} inspect={inspect} />
        <DiagnosticCharts s={s} rows={rows} inspect={inspect} compact />
      </div>
      <div className="bottom-grid">
        <section className="card model-summary">
          <div className="section-heading">
            <h3>Your current model</h3>
            <span className="pill">{oil ? "Black oil" : "Dry gas"}</span>
          </div>
          <div className="summary-items">
            <div>
              <span>Tank formulation</span>
              <strong>
                {oil
                  ? "General oil material balance"
                  : "Gas reservoir volume balance"}
              </strong>
            </div>
            <div>
              <span>Water influx</span>
              <strong>
                {s.aquifer === "none"
                  ? "None · closed tank"
                  : "Pot · equilibrium storage"}
              </strong>
            </div>
            <div>
              <span>PVT source</span>
              <strong>
                {s.pvt.mode === "table"
                  ? "User-supplied table"
                  : oil
                    ? "Calibrated VB / Sutton–DAK"
                    : "Sutton–DAK gas correlation"}
              </strong>
            </div>
          </div>
          <div className="subtle-note">
            <CircleCheck size={15} />
            {rows.some((r) => r.error)
              ? "Review calculation warnings before interpretation."
              : "All history timesteps have a pressure solution."}
          </div>
        </section>
        <section className="card learning-card">
          <span className="eyebrow">THE ENGINEERING BEHIND THE CURVE</span>
          <h3>Every point has a story.</h3>
          <p>
            Click a survey on any chart to inspect its PVT, withdrawal and
            expansion terms. See how the balance closes, term by term.
          </p>
          <button
            className="text-button"
            onClick={() => setTab("Methodology & Equations")}
          >
            Open methodology <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
  units,
  note,
  arrow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  units: string;
  note: string;
  arrow?: boolean;
}) {
  return (
    <section className="stat">
      <div className="stat-title">
        {label}
        <span>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <small>{units}</small>
      </div>
      <p>
        {arrow && <ArrowDownRight size={13} />} {note}
      </p>
    </section>
  );
}
