import { historyLabel } from "../engineering/observation";
import { useState } from "react";
import type { Scenario, SolvedRow } from "../types";
import { Chart, colors } from "../charts/Chart";
import { fromField, reservoirUnit } from "../engineering/units";
import { fmt } from "./Overview";
export function Drive({
  s,
  rows,
  inspect,
}: {
  s: Scenario;
  rows: SolvedRow[];
  inspect: (id: string) => void;
}) {
  const [basis, setBasis] = useState<"measured" | "predicted">("measured");
  if (s.model === "gas")
    return (
      <section className="card">
        <span className="eyebrow">OIL DRIVE INDICES</span>
        <h2>Select an oil reservoir to study drive mechanisms.</h2>
        <p className="interpretation">
          The oil indices compare dissolved-gas/oil expansion, gas cap,
          rock/water expansion and water influx. For dry gas, use the Cole
          diagnostic and the general gas balance in the Material Balance tab.
        </p>
      </section>
    );
  const points = rows
      .map((r) =>
        basis === "predicted" ? { ...r, measured: r.predictedBalance } : r,
      )
      .filter((r) => r.measured),
    latest = points.at(-1)?.measured;
  return (
    <>
      <div className="page-title">
        <div>
          <h2>Reservoir drive mechanisms</h2>
          <p>Signed, model-calculated support evaluated at {basis} pressure.</p>
        </div>
        <div>
          <span className="pill">No forced normalization</span>
          <select
            aria-label="Drive index pressure basis"
            value={basis}
            onChange={(e) => setBasis(e.target.value as typeof basis)}
          >
            <option value="measured">At measured pressure</option>
            <option value="predicted">At calculated pressure</option>
          </select>
        </div>
      </div>
      <Chart
        title="Material balance contributions"
        subtitle={`Signed model contributions at ${basis} pressure · excluded surveys remain labelled`}
        data={(["oil", "gas", "rock", "We"] as const).map((k, i) => ({
          type: "bar",
          name: [
            "Oil / dissolved gas",
            "Gas cap",
            "Rock / connate water",
            "Water influx",
          ][i],
          x: points.map((r) => historyLabel(r.row)),
          y: points.map(
            (r) => fromField(r.measured![k], "liquid", s.units) / 1e6,
          ),
          customdata: points.map((r) =>
            basis === "predicted" ? `predicted:${r.row.id}` : r.row.id,
          ),
          marker: {
            color: [colors.green, colors.orange, colors.olive, colors.blue][i],
          },
        }))}
        xTitle="Survey / observation"
        yTitle={`Model support (MM ${reservoirUnit(s.units)})`}
        layout={{ barmode: "relative" }}
        height={380}
        onPoint={inspect}
      />
      <div className="notice soft">
        <strong>Indices = signed contribution / net withdrawal F.</strong>
        <p>
          Oil = NEo/F; gas cap = NEg/F (m is already included in Eg); rock/water
          = NEfw/F; aquifer = We/F. Indices are suppressed when |F| &lt; 1 rb.
          Values may be negative or sum above/below 100%. These are calculated
          indices, not measured proportions. Closure is support minus F; the
          model closes when |closure| ≤ max(1 rb, 0.1% |F|).
        </p>
        {latest && (
          <p>
            Latest survey: total indices{" "}
            {fmt(
              latest.indices
                ? latest.indices.reduce((sum, x) => sum + x, 0) * 100
                : null,
              3,
            )}
            % · closure {fmt(fromField(latest.closure, "liquid", s.units), 3)}{" "}
            {reservoirUnit(s.units)} ·{" "}
            <strong>
              {Math.abs(latest.closure) <=
              Math.max(1, 0.001 * Math.abs(latest.F))
                ? "Balance closes"
                : "Balance does not close"}
            </strong>
            .
          </p>
        )}
      </div>
      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Survey / observation</th>
                <th>Oil / gas (%)</th>
                <th>Gas cap (%)</th>
                <th>Rock / water (%)</th>
                <th>Influx (%)</th>
                <th>Total (%)</th>
                <th>Closure ({reservoirUnit(s.units)})</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {points.map((r) => {
                const b = r.measured!;
                return (
                  <tr key={r.row.id}>
                    <td>
                      {historyLabel(r.row)}
                      {!r.row.use && <small>Excluded from match</small>}
                    </td>
                    {[0, 1, 2, 3].map((i) => (
                      <td key={i}>
                        {fmt(b.indices ? b.indices[i] * 100 : null, 2)}
                      </td>
                    ))}
                    <td>
                      {fmt(
                        b.indices
                          ? b.indices.reduce((s, x) => s + x, 0) * 100
                          : null,
                        2,
                      )}
                    </td>
                    <td>{fmt(fromField(b.closure, "liquid", s.units), 3)}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          inspect(
                            basis === "predicted"
                              ? `predicted:${r.row.id}`
                              : r.row.id,
                          )
                        }
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="interpretation">
        A dominant contribution is conditional on the entered N, m, PVT,
        compressibilities and aquifer model. Misfit and uncertain inputs can
        change these indices. Net injection or pressure above initial conditions
        can create signed backflow and negative expansion.
      </p>
    </>
  );
}
