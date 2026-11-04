import { useState } from "react";
import { Download, Upload } from "lucide-react";
import type { PVT, Scenario } from "../types";
import { makePVT, sutton, validateTable } from "../engineering/pvt";
import { parseTable, serializeCSV } from "../engineering/history";
import { download } from "../engineering/project";
import { fromField, toField, unit } from "../engineering/units";
import { Chart, colors } from "../charts/Chart";
import { fmt } from "./Overview";
export function PVTPage({
  s,
  change,
  inspect,
}: {
  s: Scenario;
  change: (s: Scenario) => void;
  inspect: (id: string) => void;
}) {
  const [error, setError] = useState(""),
    [fileUnits, setFileUnits] = useState(s.units);
  const rows: PVT[] = [],
    samplingErrors: string[] = [];
  try {
    const pvt = makePVT(s.pvt, s.params, s.model);
    if (s.pvt.mode === "table") rows.push(...s.pvt.table);
    else {
      const critical = sutton(s.params.gasGravity),
        low = Math.max(0.2 * critical.ppc, s.params.pi * 0.12),
        high = Math.min(
          30 * critical.ppc,
          Math.max(s.params.pi * 1.25, s.params.pb * 1.2),
        );
      const pressures = Array.from(
        { length: 40 },
        (_, i) => low + ((high - low) * i) / 39,
      ).concat(s.params.pi, s.params.pb);
      for (const p of [...new Set(pressures)].sort((a, b) => a - b)) {
        try {
          rows.push(pvt(p));
        } catch (e) {
          samplingErrors.push((e as Error).message);
        }
      }
    }
  } catch (e) {
    samplingErrors.push((e as Error).message);
  }
  const load = (text: string) => {
    const t = parseTable(text),
      required = ["Pressure", "Bo", "Rs", "Bg", "Bw", "Z"];
    const indexes = required.map((key) =>
      t.headers.findIndex((h) => h.toLowerCase() === key.toLowerCase()),
    );
    if (indexes.some((i) => i < 0))
      throw new Error("PVT CSV requires Pressure, Bo, Rs, Bg, Bw, Z headers.");
    const table = t.rows.map((r, n): PVT => {
      const v = indexes.map((i) => {
        if (!r[i]?.trim() || !Number.isFinite(Number(r[i])))
          throw new Error(
            `PVT row ${n + 1} has a missing or invalid property.`,
          );
        return Number(r[i]);
      });
      return {
        pressure: toField(v[0], "pressure", fileUnits),
        bo: v[1],
        rs: toField(v[2], "rs", fileUnits),
        bg: toField(v[3], "bg", fileUnits),
        bw: v[4],
        z: v[5],
      };
    });
    const valid = validateTable(table);
    if (
      !s.pvt.extrapolate &&
      (s.params.pi < valid[0].pressure || s.params.pi > valid.at(-1)!.pressure)
    )
      throw new Error(
        "PVT range must cover initial reservoir pressure. Change pi or explicitly enable extrapolation before upload.",
      );
    change({ ...s, pvt: { ...s.pvt, mode: "table", table: valid } });
    setError("");
  };
  const trace = (key: keyof PVT, name: string, color: string) => ({
    type: "scatter" as const,
    mode: "lines+markers" as const,
    name,
    x: rows.map((r) => fromField(r.pressure, "pressure", s.units)),
    y: rows.map((r) =>
      key === "bg"
        ? fromField(r.bg, "bg", s.units)
        : key === "rs"
          ? fromField(r.rs, "rs", s.units)
          : r[key],
    ),
    customdata: rows.map((r) => `pvt:${r.pressure}`),
    line: { color, width: 2 },
    marker: { size: 4 },
  });
  let initial: PVT | null = null;
  try {
    initial = makePVT(s.pvt, s.params, s.model)(s.params.pi);
  } catch {
    /* Display the explicit sampling error below. */
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h2>Pressure–volume–temperature</h2>
          <p>
            One selected source powers every diagnostic and forward calculation.
          </p>
        </div>
        <div className="segmented">
          <button
            className={s.pvt.mode === "correlation" ? "active" : ""}
            onClick={() =>
              change({ ...s, pvt: { ...s.pvt, mode: "correlation" } })
            }
          >
            Published correlations
          </button>
          <button
            className={s.pvt.mode === "table" ? "active" : ""}
            disabled={!s.pvt.table.length}
            title={
              !s.pvt.table.length
                ? "Upload a PVT table first"
                : "Use uploaded PVT table"
            }
            onClick={() => change({ ...s, pvt: { ...s.pvt, mode: "table" } })}
          >
            PVT table
          </button>
        </div>
      </div>
      <div className="card pvt-config">
        <div>
          <h3>
            {s.pvt.mode === "correlation"
              ? s.model === "oil"
                ? "Calibrated Vasquez–Beggs + Sutton / DAK"
                : "Sutton / Dranchuk–Abou-Kassem"
              : "User-supplied PVT · piecewise linear interpolation"}
          </h3>
          <p className="micro">
            {s.pvt.mode === "correlation"
              ? "Sweet hydrocarbon gas only. Sutton: gas gravity 0.57–1.68. DAK: Tpr 1.05–3, Ppr 0.2–30. No sour-gas or condensate correction."
              : "All six properties are interpolated linearly in pressure. No silent extrapolation; explicit opt-in below applies to diagnostics and prediction."}
          </p>
          {s.model === "oil" && s.pvt.mode === "correlation" && (
            <p className="micro">
              VB Rs is calibrated to entered Rsi at Pb (pi ≥ Pb). Above Pb, Rs
              is constant and Bo integrates co = A/p exactly. Gas gravity is
              assumed corrected to 100 psig separator conditions. Bw is a
              user-specified constant. Oil range: 75–294 °F, 15.3–59.5 °API, γgc
              0.57–1.351.
            </p>
          )}
        </div>
        <div className="pvt-upload">
          <label className="field-label">
            PVT CSV units
            <select
              value={fileUnits}
              onChange={(e) =>
                setFileUnits(e.target.value as Scenario["units"])
              }
            >
              <option>FIELD</option>
              <option>METRIC</option>
            </select>
          </label>
          <label className="file-button">
            <Upload size={14} /> Upload PVT CSV
            <input
              type="file"
              accept=".csv,.txt"
              onChange={async (e) => {
                try {
                  if (e.target.files?.[0]) load(await e.target.files[0].text());
                } catch (err) {
                  setError((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div className="notice soft">
        <strong>PVT table format:</strong> Pressure, Bo, Rs, Bg, Bw, Z.{" "}
        {fileUnits === "FIELD"
          ? "psia, rb/STB, scf/STB, rb/scf, rb/STB, dimensionless."
          : "MPa(a), rm³/sm³, sm³/sm³, rm³/sm³, rm³/sm³, dimensionless."}{" "}
        Gas Bg and liquid Bo use different surface volume bases.
        <label className="check">
          <input
            type="checkbox"
            checked={s.pvt.extrapolate}
            onChange={(e) =>
              change({ ...s, pvt: { ...s.pvt, extrapolate: e.target.checked } })
            }
          />{" "}
          Explicitly allow linear PVT-table extrapolation beyond the uploaded
          range
        </label>
        {s.pvt.extrapolate && (
          <p>
            Extrapolation is enabled. Nonphysical extrapolated properties are
            still rejected. Predictions outside laboratory coverage are
            uncertain.
          </p>
        )}
      </div>
      {(error || samplingErrors.length > 0) && (
        <div role="alert" className="notice error">
          {error || [...new Set(samplingErrors)].join(" ")}
        </div>
      )}
      {initial && (
        <div className="metric-line">
          Initial Z <strong>{fmt(initial.z, 5)}</strong> Initial Bg{" "}
          <strong>
            {fmt(fromField(initial.bg, "bg", s.units), 7)} {unit("bg", s.units)}
          </strong>
          {s.model === "oil" && (
            <>
              Initial Bo{" "}
              <strong>
                {fmt(initial.bo, 5)}{" "}
                {s.units === "FIELD" ? "rb/STB" : "rm³/sm³"}
              </strong>
            </>
          )}
        </div>
      )}
      <div className="chart-grid">
        {s.model === "oil" && (
          <>
            <Chart
              title="Oil formation volume factor"
              data={[trace("bo", "Bo", colors.green)]}
              xTitle={`Pressure (${unit("pressure", s.units)})`}
              yTitle={`Bo (${s.units === "FIELD" ? "rb/STB" : "rm³/sm³"})`}
              onPoint={inspect}
            />
            <Chart
              title="Solution gas–oil ratio"
              data={[trace("rs", "Rs", colors.orange)]}
              xTitle={`Pressure (${unit("pressure", s.units)})`}
              yTitle={`Rs (${unit("rs", s.units)})`}
              onPoint={inspect}
            />
          </>
        )}
        <Chart
          title="Gas deviation factor"
          data={[trace("z", "Z", colors.olive)]}
          xTitle={`Pressure (${unit("pressure", s.units)})`}
          yTitle="Z (dimensionless)"
          onPoint={inspect}
        />
        <Chart
          title="Gas formation volume factor"
          data={[trace("bg", "Bg", colors.blue)]}
          xTitle={`Pressure (${unit("pressure", s.units)})`}
          yTitle={`Bg (${unit("bg", s.units)})`}
          onPoint={inspect}
        />
        <Chart
          title="Water formation volume factor"
          data={[trace("bw", "Bw", colors.blue)]}
          xTitle={`Pressure (${unit("pressure", s.units)})`}
          yTitle={`Bw (${s.units === "FIELD" ? "rb/STB" : "rm³/sm³"})`}
          onPoint={inspect}
        />
      </div>
      <section className="card">
        <div className="section-heading">
          <h3>
            {s.pvt.mode === "table"
              ? "Loaded PVT table"
              : "Sampled PVT properties"}
          </h3>
          <button
            onClick={() =>
              download(
                serializeCSV(
                  rows.map((r) => ({
                    Pressure: fromField(r.pressure, "pressure", s.units),
                    Bo: r.bo,
                    Rs: fromField(r.rs, "rs", s.units),
                    Bg: fromField(r.bg, "bg", s.units),
                    Bw: r.bw,
                    Z: r.z,
                  })),
                ),
                "pvt.csv",
                "text/csv",
              )
            }
          >
            <Download size={13} /> Export table
          </button>
        </div>
        <div className="table-scroll pvt-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pressure ({unit("pressure", s.units)})</th>
                <th>Bo ({s.units === "FIELD" ? "rb/STB" : "rm³/sm³"})</th>
                <th>Rs ({unit("rs", s.units)})</th>
                <th>Bg ({unit("bg", s.units)})</th>
                <th>Bw ({s.units === "FIELD" ? "rb/STB" : "rm³/sm³"})</th>
                <th>Z (–)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pressure}>
                  <td>{fmt(fromField(r.pressure, "pressure", s.units), 3)}</td>
                  <td>{fmt(r.bo, 6)}</td>
                  <td>{fmt(fromField(r.rs, "rs", s.units), 3)}</td>
                  <td>{fmt(fromField(r.bg, "bg", s.units), 8)}</td>
                  <td>{fmt(r.bw, 5)}</td>
                  <td>{fmt(r.z, 6)}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => inspect(`pvt:${r.pressure}`)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
