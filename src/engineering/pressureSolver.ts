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
  if (s.model === "oil" && s.pvt.oilMode === "undersaturated")
    lo = Math.max(lo, s.params.pb);
  const knots = [
    ...Array.from({ length: 101 }, (_, i) => lo + ((hi - lo) * i) / 100),
    pi,
    ...(s.pvt.mode === "table"
      ? s.pvt.table.map((r) => r.pressure)
      : [s.params.pb]),
  ].filter((p) => p >= lo && p <= hi);
  const roots = scanRoots(f, knots);
  if (!roots.length)
    throw new Error(
      `No pressure root in ${lo.toFixed(1)}–${hi.toFixed(1)} psia. Check fluid inventory, injection and PVT coverage.`,
    );
  roots.sort((a, b) => Math.abs(a.root - pi) - Math.abs(b.root - pi));
  const result = roots[0],
    b = balanceAt(s, row, result.root, pvt),
    tolerance = Math.max(
      1e-4,
      1e-8 * Math.max(Math.abs(b.F), Math.abs(b.support)),
    );
  if (Math.abs(result.residual) > tolerance)
    throw new Error(
      `Pressure-width convergence did not satisfy volume closure tolerance (${tolerance} rb).`,
    );
  return {
    ...result,
    candidates: roots.map((r) => r.root),
    ...(roots.length > 1
      ? {
          warnings: [
            `Multiple pressure roots detected (${roots.length}); nearest pi selected. The physical branch is ambiguous; do not use for auto matching.`,
          ],
        }
      : {}),
  };
}
/** Finite scanning detects separated sign-changing roots, not a proof that all roots exist. */
export function scanRoots(
  f: (p: number) => number,
  knots: number[],
): RootResult[] {
  const sorted = [...new Set(knots)].sort((a, b) => a - b),
    roots: RootResult[] = [];
  let last: { p: number; v: number } | null = null;
  for (const p of sorted) {
    let v: number;
    try {
      v = f(p);
      if (!Number.isFinite(v)) throw new Error("Invalid residual");
    } catch {
      last = null;
      continue;
    }
    let result: RootResult | null = null;
    if (v === 0) result = { root: p, iterations: 0, residual: 0 };
    else if (last && last.v !== 0 && Math.sign(v) !== Math.sign(last.v))
      result = bisect(f, last.p, p, 1e-10);
    if (result && !roots.some((r) => Math.abs(r.root - result!.root) < 1e-6))
      roots.push(result);
    last = { p, v };
  }
  return roots;
}
