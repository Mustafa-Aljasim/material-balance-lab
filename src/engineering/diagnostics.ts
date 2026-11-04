import type { Scenario, SolvedRow } from "../types";
import { makePVT } from "./pvt";
import { balanceAt, solvePressure } from "./pressureSolver";
import { historyIssues } from "./history";
export function evaluate(s: Scenario): SolvedRow[] {
  const issues = historyIssues(s.history, s.params.pi);
  if (issues.length) throw new Error(issues.slice(0, 3).join(" "));
  if (s.model === "gas" && s.history.some((r) => r.np > 0))
    throw new Error(
      "Dry-gas balance does not support oil production. Select Oil or provide a dry-gas history.",
    );
  const a = s.params;
  if (!(
    a.pi > 14.7 &&
    a.N > 0 &&
    a.G > 0 &&
    a.m >= 0 &&
    a.swi >= 0 &&
    a.swi < 1 &&
    a.cf >= 0 &&
    a.cw >= 0 &&
    a.bw > 0 &&
    a.bwi > 0 &&
    (a.bgi === null || a.bgi > 0) &&
    (a.zi === null || a.zi > 0)
  ))
    throw new Error(
      "Invalid tank inputs: require positive inventory, pressure and FVFs, 0 ≤ Swi < 1, and nonnegative m/compressibilities.",
    );
  const pvt = makePVT(s.pvt, a, s.model);
  pvt(a.pi);
  return s.history.map((row) => {
    let measured = null,
      predicted = null,
      predictedBalance = null;
    const errors: string[] = [];
    if (row.pressure !== null)
      try {
        measured = balanceAt(s, row, row.pressure, pvt);
      } catch (e) {
        errors.push(`Survey: ${(e as Error).message}`);
      }
    try {
      predicted = solvePressure(s, row, pvt).root;
      predictedBalance = balanceAt(s, row, predicted, pvt);
    } catch (e) {
      errors.push(`Prediction: ${(e as Error).message}`);
    }
    return {
      row,
      measured,
      predicted,
      predictedBalance,
      residual:
        predicted !== null && row.pressure !== null
          ? predicted - row.pressure
          : null,
      error: errors.length ? errors.join(" ") : undefined,
    };
  });
}
export function metrics(rows: SolvedRow[]) {
  const active = rows.filter((r) => r.row.use && r.row.pressure !== null),
    valid = active.filter((r) => r.residual !== null);
  return {
    count: active.length,
    solved: valid.length,
    rmse: valid.length
      ? Math.sqrt(
          valid.reduce((s, r) => s + r.residual! ** 2, 0) / valid.length,
        )
      : null,
    mae: valid.length
      ? valid.reduce((s, r) => s + Math.abs(r.residual!), 0) / valid.length
      : null,
  };
}
export function originSlope(points: [number, number][]): number | null {
  const denominator = points.reduce((sum, [x]) => sum + x * x, 0);
  return denominator > 1e-20
    ? points.reduce((sum, [x, y]) => sum + x * y, 0) / denominator
    : null;
}
export function linearFit(points: [number, number][]) {
  if (points.length < 2) return null;
  const n = points.length,
    mx = points.reduce((s, [x]) => s + x, 0) / n,
    my = points.reduce((s, [, y]) => s + y, 0) / n;
  const xx = points.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (!xx) return null;
  const slope = points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / xx,
    intercept = my - slope * mx;
  return {
    slope,
    intercept,
    interceptX: slope < 0 ? -intercept / slope : null,
  };
}
export function pzValidity(s: Scenario, rows: SolvedRow[]): string[] {
  const why: string[] = [];
  if (s.aquifer === "pot" && s.params.caq > 0) why.push("aquifer support");
  if (s.params.cf !== 0 || s.params.swi * s.params.cw !== 0)
    why.push("rock/connate-water expansion");
  if (
    s.history.some(
      (r) => r.wp > 0 || (s.params.injection && (r.wi > 0 || r.gi > 0)),
    )
  )
    why.push("water production or injection");
  const initial = makePVT(s.pvt, s.params, s.model)(s.params.pi);
  if (
    rows.some(
      (r) =>
        r.measured &&
        Math.abs(
          r.measured.pvt.bg /
            initial.bg /
            (r.measured.pvt.z / r.measured.p / (initial.z / s.params.pi)) -
            1,
        ) > 0.005,
    )
  )
    why.push("PVT Bg and Z/p differ by over 0.5%");
  return why;
}
