import type { Scenario, SolvedRow } from "../types";
import { linearFit, originSlope } from "./diagnostics";
import { makePVT } from "./pvt";
import { balanceAt } from "./pressureSolver";
export function gasCapRegression(s: Scenario, rows: SolvedRow[]) {
  const points = rows
    .filter((r) => r.row.use && r.measured && r.measured.EgBase !== null)
    .flatMap((r) => {
      const b = r.measured!,
        K = b.rockBase ?? b.Efw / (1 + s.params.m),
        A = b.Eo + K,
        B = b.EgBase! + K;
      return Math.abs(A) > 1e-10
        ? [{ x: B / A, y: (b.F - b.We) / A, id: r.row.id }]
        : [];
    });
  const fit = linearFit(points.map((p) => [p.x, p.y]));
  if (!fit)
    return {
      points,
      fit: null,
      warnings: [
        "At least two distinct nonzero-expansion observations are required.",
      ],
    };
  const x = points.map((p) => p.x),
    n = x.length,
    sum = x.reduce((s, v) => s + v, 0),
    square = x.reduce((s, v) => s + v * v, 0);
  const correlation = square > 0 ? -sum / Math.sqrt(n * square) : null;
  const m = fit.intercept > 0 ? fit.slope / fit.intercept : null;
  const warnings: string[] = [];
  if (n < 3)
    warnings.push(
      "Only two observations: no redundancy to assess parameter stability.",
    );
  if (correlation !== null && Math.abs(correlation) > 0.98)
    warnings.push(
      "N and Nm are strongly correlated; the intercept extrapolates far outside the observations. A good line does not uniquely establish N and m.",
    );
  if (fit.intercept <= 0 || m === null || m < 0)
    warnings.push("The unconstrained regression gives nonphysical N or m.");
  const loo =
    n > 3
      ? points.flatMap((_, i) => {
          const f = linearFit(
            points.filter((_, j) => i !== j).map((p) => [p.x, p.y]),
          );
          return f && f.intercept > 0
            ? [{ N: f.intercept, m: f.slope / f.intercept }]
            : [];
        })
      : [];
  return {
    points,
    fit: {
      N: fit.intercept,
      Nm: fit.slope,
      m,
      coefficientCorrelation: correlation,
      leaveOneOutN: loo.length
        ? [Math.min(...loo.map((v) => v.N)), Math.max(...loo.map((v) => v.N))]
        : null,
      leaveOneOutM: loo.length
        ? [Math.min(...loo.map((v) => v.m)), Math.max(...loo.map((v) => v.m))]
        : null,
    },
    warnings,
  };
}

/** One printed PVT cell at a time, ± half its final printed digit.
 * This is a rounding stress test, not a statistical confidence interval. */
export function roundingSensitivity(s: Scenario) {
  const results: { fixedN: number; jointN: number; m: number }[] = [];
  let rejected = 0,
    nonphysical = 0;
  for (let i = 0; i < s.pvt.table.length; i++) {
    for (const [key, digit] of [
      ["bo", 0.0001],
      ["rs", 1],
      ["bg", 0.00001],
    ] as const) {
      for (const sign of [-1, 1]) {
        try {
          const candidate = structuredClone(s);
          const value = candidate.pvt.table[i][key];
          if (value === null) throw new Error("Missing source PVT");
          candidate.pvt.table[i][key] = value + (sign * digit) / 2;
          const pvt = makePVT(candidate.pvt, candidate.params, candidate.model);
          const rows = candidate.history.map((row) => ({
            row,
            measured:
              row.pressure === null
                ? null
                : balanceAt(candidate, row, row.pressure, pvt),
            predicted: null,
            predictedBalance: null,
            residual: null,
          }));
          const fit = gasCapRegression(candidate, rows).fit;
          const fixedN = originSlope(
            rows
              .filter((r) => r.row.use && r.measured)
              .map((r) => [r.measured!.Et, r.measured!.F - r.measured!.We]),
          );
          if (!fit || fit.N === 0 || fixedN === null)
            throw new Error("Unresolved regression");
          const m = fit.Nm / fit.N;
          if (fit.N <= 0 || m < 0) nonphysical++;
          results.push({ fixedN, jointN: fit.N, m });
        } catch {
          rejected++;
        }
      }
    }
  }
  const range = (key: keyof (typeof results)[number]) =>
    results.length
      ? [
          Math.min(...results.map((r) => r[key])),
          Math.max(...results.map((r) => r[key])),
        ]
      : null;
  return {
    trials: results.length,
    rejected,
    nonphysical,
    fixedN: range("fixedN"),
    jointN: range("jointN"),
    m: range("m"),
  };
}
