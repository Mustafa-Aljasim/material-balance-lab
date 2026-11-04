import type { HistoryRow, PVTProvider, RootResult, Scenario } from "../types";
import { oilBalance } from "./oilMBE";
import { gasBalance } from "./gasMBE";
export function bisect(
  f: (p: number) => number,
  low: number,
  high: number,
  tolerance = 1e-6,
  maxIterations = 100,
): RootResult {
  let fl = f(low),
    fh = f(high);
  if (![fl, fh].every(Number.isFinite))
    throw new Error("Nonfinite balance at root bracket.");
  if (fl === 0) return { root: low, iterations: 0, residual: 0 };
  if (fh === 0) return { root: high, iterations: 0, residual: 0 };
  if (Math.sign(fl) === Math.sign(fh))
    throw new Error("No sign change: pressure root is not bracketed.");
  for (let i = 1; i <= maxIterations; i++) {
    const p = (low + high) / 2,
      fm = f(p);
    if (!Number.isFinite(fm))
      throw new Error("Nonfinite balance during root solve.");
    if (fm === 0 || (high - low) / 2 <= tolerance)
      return { root: p, iterations: i, residual: fm };
    if (Math.sign(fl) === Math.sign(fm)) {
      low = p;
      fl = fm;
    } else {
      high = p;
      fh = fm;
    }
  }
  throw new Error(
    `Pressure root failed to converge in ${maxIterations} iterations.`,
  );
}
export const balanceAt = (
  s: Scenario,
  row: HistoryRow,
  p: number,
  pvt: PVTProvider,
) =>
  (s.model === "oil" ? oilBalance : gasBalance)(
    p,
    row,
    s.params,
    pvt,
    s.aquifer,
  );
export function solvePressure(
  s: Scenario,
  row: HistoryRow,
  pvt: PVTProvider,
): RootResult {
  const pi = s.params.pi;
  const f = (p: number) => balanceAt(s, row, p, pvt).closure;
  // Measured pressure and survey-use flags are deliberately never read here.
  const fi = f(pi);
  if (Math.abs(fi) <= 1e-8) return { root: pi, iterations: 0, residual: fi };
  let lo = 14.7,
    hi = Math.max(pi * 1.6, pi + 1000);
  if (s.pvt.mode === "table" && !s.pvt.extrapolate) {
    lo = Math.min(...s.pvt.table.map((r) => r.pressure));
    hi = Math.max(...s.pvt.table.map((r) => r.pressure));
  }
  if (s.pvt.mode === "correlation") {
    const ppc =
      756.8 - 131 * s.params.gasGravity - 3.6 * s.params.gasGravity ** 2;
    lo = Math.max(lo, 0.2 * ppc);
    hi = Math.min(hi, 30 * ppc);
  }
  // Search outward from pi and select the nearest continuous bracket. Supports pressure above pi with net injection.
  const direction = fi < 0 ? -1 : 1,
    bound = direction < 0 ? lo : hi;
  let lastP = pi,
    lastF = fi;
  for (let i = 1; i <= 100; i++) {
    const p = pi + ((bound - pi) * i) / 100,
      fp = f(p);
    if (Math.sign(fp) !== Math.sign(lastF) || fp === 0)
      return bisect(f, Math.min(lastP, p), Math.max(lastP, p));
    lastP = p;
    lastF = fp;
  }
  throw new Error(
    `No pressure root in ${lo.toFixed(1)}–${hi.toFixed(1)} psia. Check fluid inventory, injection and PVT coverage.`,
  );
}
