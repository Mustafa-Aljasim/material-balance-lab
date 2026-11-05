import type { Scenario, SolvedRow } from "../types";
import { gasCapRegression } from "../engineering/gasCapRegression";
import { Chart, colors } from "../charts/Chart";
import { fromField, unit } from "../engineering/units";
import { fmt } from "../pages/Overview";
import { MathBlock } from "./Math";
export function GasCapAnalysis({
  s,
  rows,
  inspect,
}: {
  s: Scenario;
  rows: SolvedRow[];
  inspect: (id: string) => void;
}) {
  if (s.model !== "oil" || s.pvt.oilMode === "undersaturated") return null;
  const result = gasCapRegression(s, rows),
    f = result.fit,
    convert = (v: number) => fromField(v, "liquid", s.units) / 1e6,
    x = result.points.map((p) => p.x),
    extent = x.length ? [Math.min(0, ...x), Math.max(...x)] : [0, 1];
  return (
    <section className="gas-cap-analysis">
      <div className="page-title">
        <div>
          <h2>Gas-cap linearization · N and m</h2>
          <p>
            Separate unweighted intercept/slope analysis, corrected for declared
            influx.
          </p>
        </div>
      </div>
      <MathBlock
        equation={String.raw`K=B_{oi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p),\quad \frac{F-W_e}{E_o+K}=N+Nm\frac{E_g^0+K}{E_o+K}`}
      />
      <p className="interpretation">
        Eg⁰ = Boi(Bg/Bgi − 1), before multiplication by m. The engine’s stored
        Eg is mEg⁰. With zero compressibility, this reduces to F/Eo versus
        Eg⁰/Eo. Intercept = N, slope = Nm, and m = slope/intercept. Invalid or
        zero denominators are omitted.
      </p>
      <Chart
        title="Gas-cap intercept & slope"
        data={[
          {
            type: "scatter",
            mode: "markers",
            name: "Selected surveys",
            x,
            y: result.points.map((p) => convert(p.y)),
            customdata: result.points.map((p) => p.id),
            marker: { color: colors.orange, size: 8 },
          },
          ...(f
            ? [
                {
                  type: "scatter" as const,
                  mode: "lines" as const,
                  name: "Unconstrained regression",
                  x: extent,
                  y: extent.map((v) => convert(f.N + f.Nm * v)),
                  line: { color: colors.green },
                },
              ]
            : []),
        ]}
        xTitle="(Eg⁰ + K) / (Eo + K) (dimensionless)"
        yTitle={`(F − We) / (Eo + K) (MM ${unit("liquid", s.units)})`}
        onPoint={inspect}
      />
      {f && (
        <div className="card">
          <div className="metric-line">
            N{" "}
            <strong>
              {fmt(convert(f.N), 4)} MM {unit("liquid", s.units)}
            </strong>
            m <strong>{fmt(f.m, 6)}</strong>corr(N, Nm){" "}
            <strong>{fmt(f.coefficientCorrelation, 6)}</strong>
          </div>
          <p className="micro">
            Leave-one-survey-out sensitivity (not confidence intervals): N{" "}
            {f.leaveOneOutN?.map((v) => fmt(convert(v), 3)).join(" to ") ??
              "unavailable"}{" "}
            MM {unit("liquid", s.units)}; m{" "}
            {f.leaveOneOutM?.map((v) => fmt(v, 4)).join(" to ") ??
              "unavailable"}
            . This assesses survey leverage; tabulated PVT rounding introduces
            additional uncertainty. N and Nm coefficient correlation is
            conditional on unweighted homoscedastic linear regression, not a
            physical prior.
          </p>
        </div>
      )}
      {result.warnings.map((w) => (
        <p className="notice warning" key={w}>
          {w}
        </p>
      ))}
    </section>
  );
}
