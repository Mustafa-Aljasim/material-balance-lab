import { useState } from "react";
import type { Scenario } from "../types";
import { autoMatch } from "../engineering/matching";
import type {
  MatchBounds,
  MatchParameter,
  MatchResult,
} from "../engineering/matching";
import { evaluate } from "../engineering/diagnostics";
import { fromField, toField, unit } from "../engineering/units";
import { historyLabel, historyAxisTitle } from "../engineering/observation";
import { Chart, colors } from "../charts/Chart";
import { Inspector } from "./Inspector";
import { fmt } from "../pages/Overview";
export function AutoMatch({
  s,
  change,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
}) {
  const [mode, setMode] = useState<"N" | "m" | "caq">("N"),
    [limits, setLimits] = useState<Record<MatchParameter, [number, number]>>({
      N: [s.params.N * 0.5, s.params.N * 1.8],
      m: [0, 1.5],
      caq: [0, Math.max(50000, s.params.caq * 3)],
    }),
    [result, setResult] = useState<{
      fit: MatchResult;
      anchor: string;
      before: Scenario;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const signature = JSON.stringify([
      s.params,
      s.pvt,
      s.history,
      s.aquifer,
      s.model,
    ]),
    stale = !!result && signature !== result.anchor;
  if (s.model !== "oil")
    return (
      <p className="notice soft">
        Auto Match supports oil inventory/cap/Pot parameters. Dry-gas
        calculations and manual matching remain available.
      </p>
    );
  const keys: MatchParameter[] = mode === "N" ? ["N"] : ["N", mode];
  const display = (v: number, k: MatchParameter) =>
    k === "N"
      ? fromField(v, "liquid", s.units) / 1e6
      : k === "caq"
        ? fromField(v, "storage", s.units)
        : v;
  let previewRows: ReturnType<typeof evaluate> = [],
    beforeRows: ReturnType<typeof evaluate> = [];
  const preview = result
    ? { ...result.before, params: result.fit.params }
    : null;
  if (preview) {
    try {
      previewRows = evaluate(preview);
      beforeRows = evaluate(result!.before);
    } catch {
      /* Fit errors are displayed independently. */
    }
  }
  return (
    <section className="card auto-match">
      <div className="page-title">
        <div>
          <h2>Bounded Auto Match</h2>
          <p>
            Fit active pressure surveys with fixed PVT and fixed parameters
            outside the selected pair.
          </p>
        </div>
        <span className="pill">Review before applying</span>
      </div>
      <label>
        Fit parameters
        <select
          aria-label="Auto Match parameters"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setResult(null);
          }}
        >
          <option value="N">N alone</option>
          <option value="m" disabled={s.pvt.oilMode === "undersaturated"}>
            N and gas-cap ratio m
          </option>
          <option value="caq" disabled={s.aquifer !== "pot"}>
            N and Pot storage Caq
          </option>
        </select>
      </label>
      <div className="mapping-grid">
        {keys.map((k) => (
          <div key={k}>
            <strong>
              {k} (
              {k === "N"
                ? `MM ${unit("liquid", s.units)}`
                : k === "caq"
                  ? unit("storage", s.units)
                  : "dimensionless"}
              )
            </strong>
            {[0, 1].map((i) => (
              <label className="field-label" key={i}>
                {i ? "Upper" : "Lower"} bound
                <input
                  type="number"
                  step="any"
                  aria-label={`${k} ${i ? "upper" : "lower"} match bound`}
                  value={Number(display(limits[k][i], k).toPrecision(10))}
                  onChange={(e) => {
                    const value = Number(e.target.value),
                      canonical =
                        k === "N"
                          ? toField(value * 1e6, "liquid", s.units)
                          : k === "caq"
                            ? toField(value, "storage", s.units)
                            : value;
                    const next = [...limits[k]] as [number, number];
                    next[i] = canonical;
                    setLimits({ ...limits, [k]: next });
                    setResult(null);
                  }}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="micro">
        Deterministic method: bounded golden-section search for N; a 5×5 seed
        grid and bounded Nelder–Mead for two parameters, normalized to [0,1].
        Objective is pressure RMSE in psia. Every active survey must solve;
        invalid or multiple-root candidates are rejected. No PVT calibration or
        unselected parameter is varied.
      </p>
      <button
        className="primary-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          setResult(null);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          try {
            const bounds: MatchBounds[] = keys.map((key) => ({
              key,
              min: limits[key][0],
              max: limits[key][1],
            }));
            const fit = autoMatch(s, bounds);
            setResult({ fit, anchor: signature, before: structuredClone(s) });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Calculating candidate…" : "Run bounded Auto Match"}
      </button>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {result && (
        <>
          <div className="metric-line">
            {result.fit.converged
              ? "Numerically converged"
              : "Convergence not established"}{" "}
            · {result.fit.evaluations} evaluations · candidate RMSE{" "}
            <strong>
              {fmt(fromField(result.fit.after, "pressure", s.units), 5)}{" "}
              {unit("pressure", s.units)}
            </strong>
            MAE{" "}
            <strong>
              {fmt(fromField(result.fit.mae, "pressure", s.units), 5)}{" "}
              {unit("pressure", s.units)}
            </strong>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Before</th>
                <th>Candidate</th>
                <th>Sensitivity · RMS pressure change</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{fmt(display(result.before.params[k], k), 6)}</td>
                  <td>{fmt(display(result.fit.params[k], k), 6)}</td>
                  <td>
                    {fmt(
                      fromField(
                        result.fit.sensitivity.find((v) => v.key === k)
                          ?.rmsPressureChange ?? NaN,
                        "pressure",
                        s.units,
                      ),
                      5,
                    )}{" "}
                    {unit("pressure", s.units)} for Δ{k}=
                    {fmt(
                      display(
                        result.fit.sensitivity.find((v) => v.key === k)?.step ??
                          NaN,
                        k,
                      ),
                      5,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="micro">
            Baseline RMSE{" "}
            {fmt(fromField(result.fit.before, "pressure", s.units), 5)}{" "}
            {unit("pressure", s.units)}. Local parameter correlation ={" "}
            {fmt(result.fit.correlation, 6)} (— for one parameter or singular
            sensitivity). Sensitivity uses a local pressure difference (central
            where valid; one-sided at a PVT domain boundary) with a 1% parameter
            step (minimum 0.1% of its bound span). Convergence does not
            establish uniqueness.
          </p>
          {result.fit.warnings.map((w) => (
            <p className="notice warning" key={w}>
              {w}
            </p>
          ))}
          {stale && (
            <p className="notice warning">
              Inputs changed after this candidate was calculated. Rerun before
              applying.
            </p>
          )}
          <Chart
            title="Auto Match candidate pressure"
            subtitle="Candidate is not applied until you choose Apply"
            xTitle={historyAxisTitle(s.history)}
            yTitle={`Pressure (${unit("pressure", s.units)})`}
            data={[
              {
                type: "scatter",
                mode: "markers",
                name: "Measured (active)",
                x: previewRows
                  .filter((r) => r.row.use)
                  .map((r) => historyLabel(r.row)),
                y: previewRows
                  .filter((r) => r.row.use)
                  .map((r) => fromField(r.row.pressure, "pressure", s.units)),
                customdata: previewRows
                  .filter((r) => r.row.use)
                  .map((r) => `after:${r.row.id}`),
                marker: { color: colors.orange },
              },
              {
                type: "scatter",
                mode: "lines",
                name: "Before",
                x: beforeRows.map((r) => historyLabel(r.row)),
                y: beforeRows.map((r) =>
                  fromField(r.predicted, "pressure", s.units),
                ),
                customdata: beforeRows.map((r) => `before:${r.row.id}`),
                line: { color: colors.gray, dash: "dot" },
              },
              {
                type: "scatter",
                mode: "lines",
                name: "Candidate",
                x: previewRows.map((r) => historyLabel(r.row)),
                y: previewRows.map((r) =>
                  fromField(r.predicted, "pressure", s.units),
                ),
                customdata: previewRows.map((r) => `after:${r.row.id}`),
                line: { color: colors.green },
              },
            ]}
            onPoint={setSelected}
          />
          <button
            disabled={stale}
            onClick={() => {
              change({ ...s, params: result.fit.params });
              setResult(null);
            }}
          >
            Apply candidate parameters
          </button>
        </>
      )}
      {selected && result && preview && (
        <Inspector
          selected={"predicted:" + selected.replace(/^(before|after):/, "")}
          s={selected.startsWith("before:") ? result.before : preview}
          rows={selected.startsWith("before:") ? beforeRows : previewRows}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
