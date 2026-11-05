import type { Parameters, Scenario } from "../types";
import { makePVT } from "./pvt";
import { solvePressure } from "./pressureSolver";
import { historyIssues } from "./history";
export type MatchParameter = "N" | "m" | "caq";
export interface MatchBounds {
  key: MatchParameter;
  min: number;
  max: number;
}
export interface MatchResult {
  params: Parameters;
  before: number;
  after: number;
  mae: number;
  evaluations: number;
  converged: boolean;
  warnings: string[];
  correlation: number | null;
  sensitivity: {
    key: MatchParameter;
    step: number;
    rmsPressureChange: number;
  }[];
}
export function autoMatch(
  s: Scenario,
  bounds: MatchBounds[],
  maxIterations = 180,
): MatchResult {
  if (s.model !== "oil")
    throw new Error(
      "Auto Match currently supports oil only; dry-gas calculations remain manual.",
    );
  if (historyIssues(s.history, s.params.pi).length)
    throw new Error("Resolve history QC errors before matching.");
  if (
    !bounds.length ||
    bounds.length > 2 ||
    bounds[0].key !== "N" ||
    (bounds[1] && !["m", "caq"].includes(bounds[1].key))
  )
    throw new Error("Supported matches: N, N + m, N + Pot storage.");
  bounds.forEach((b) => {
    if (
      !Number.isFinite(b.min) ||
      !Number.isFinite(b.max) ||
      b.min >= b.max ||
      b.min < 0 ||
      (b.key === "N" && b.min <= 0)
    )
      throw new Error(
        "Bounds must be finite, ordered and physically positive/nonnegative.",
      );
  });
  if (bounds.some((b) => b.key === "caq") && s.aquifer !== "pot")
    throw new Error("Select Pot before fitting aquifer storage.");
  if (bounds.some((b) => b.key === "m") && s.pvt.oilMode === "undersaturated")
    throw new Error("Bo-only PVT cannot identify a gas cap.");
  const active = s.history.filter((r) => r.use && r.pressure !== null);
  if (active.length < bounds.length + 1)
    throw new Error(
      "Insufficient active surveys for the selected parameter count.",
    );
  // N/m/Caq do not alter PVT. Keep a single selected-source provider and all fixed inputs.
  const pvt = makePVT(s.pvt, s.params, s.model);
  const predict = (params: Parameters) =>
    active.map((row) => {
      const solved = solvePressure({ ...s, params }, row, pvt);
      if (solved.warnings?.length)
        throw new Error("Ambiguous forward roots cannot be used for fitting.");
      return solved.root;
    });
  const errors = (p: number[]) => p.map((v, i) => v - active[i].pressure!);
  const rms = (v: number[]) =>
    Math.sqrt(v.reduce((a, b) => a + b * b, 0) / v.length);
  const before = rms(errors(predict(s.params)));
  let evaluations = 0,
    rejected = 0;
  const clamp = (x: number[]) => x.map((v) => Math.min(1, Math.max(0, v)));
  const paramsFor = (x: number[]) => {
    const p = { ...s.params };
    bounds.forEach((b, i) => {
      p[b.key] = b.min + x[i] * (b.max - b.min);
    });
    return p;
  };
  const objective = (x: number[]) => {
    evaluations++;
    try {
      return rms(errors(predict(paramsFor(x))));
    } catch {
      rejected++;
      return Infinity;
    }
  };
  let best: number[] = bounds.map(
      (b) => (s.params[b.key] - b.min) / (b.max - b.min),
    ),
    converged = false;
  if (bounds.length === 1) {
    let a = 0,
      b = 1;
    const ratio = (Math.sqrt(5) - 1) / 2;
    let c = b - ratio * (b - a),
      d = a + ratio * (b - a),
      fc = objective([c]),
      fd = objective([d]);
    for (let i = 0; i < maxIterations; i++) {
      if (b - a < 1e-7) {
        converged = true;
        break;
      }
      if (fc < fd) {
        b = d;
        d = c;
        fd = fc;
        c = b - ratio * (b - a);
        fc = objective([c]);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + ratio * (b - a);
        fd = objective([d]);
      }
    }
    const choices = [[0], [1], [(a + b) / 2], clamp(best)];
    best = choices
      .map((x) => ({ x, f: objective(x) }))
      .sort((a, b) => a.f - b.f)[0].x;
  } else {
    // Deterministic 5x5 seeds followed by bounded Nelder–Mead on normalized coordinates.
    const seeds = Array.from({ length: 25 }, (_, i) => [
      Math.floor(i / 5) / 4,
      (i % 5) / 4,
    ])
      .concat([clamp(best)])
      .map((x) => ({ x, f: objective(x) }))
      .sort((a, b) => a.f - b.f);
    best = seeds[0].x;
    let simplex = [
      best,
      clamp([best[0] + (best[0] > 0.8 ? -0.08 : 0.08), best[1]]),
      clamp([best[0], best[1] + (best[1] > 0.8 ? -0.08 : 0.08)]),
    ].map((x) => ({ x, f: objective(x) }));
    for (let i = 0; i < maxIterations; i++) {
      simplex.sort((a, b) => a.f - b.f);
      const [a, b, c] = simplex;
      if (
        Number.isFinite(a.f) &&
        Math.max(
          ...b.x.map((v, j) => Math.abs(v - a.x[j])),
          ...c.x.map((v, j) => Math.abs(v - a.x[j])),
        ) < 1e-6 &&
        Math.abs(c.f - a.f) < 1e-5
      ) {
        converged = true;
        break;
      }
      const center = a.x.map((v, j) => (v + b.x[j]) / 2),
        evaluate = (x: number[]) => {
          const q = clamp(x);
          return { x: q, f: objective(q) };
        };
      const reflected = evaluate(center.map((v, j) => 2 * v - c.x[j]));
      if (reflected.f < a.f) {
        const expanded = evaluate(
          center.map((v, j) => v + 2 * (reflected.x[j] - v)),
        );
        simplex[2] = expanded.f < reflected.f ? expanded : reflected;
      } else if (reflected.f < b.f) simplex[2] = reflected;
      else {
        const outside = reflected.f < c.f,
          contracted = evaluate(
            center.map(
              (v, j) => v + 0.5 * ((outside ? reflected.x[j] : c.x[j]) - v),
            ),
          );
        if (contracted.f < (outside ? reflected.f : c.f))
          simplex[2] = contracted;
        else
          simplex = [
            a,
            evaluate(b.x.map((v, j) => (v + a.x[j]) / 2)),
            evaluate(c.x.map((v, j) => (v + a.x[j]) / 2)),
          ];
      }
    }
    simplex.sort((a, b) => a.f - b.f);
    best = simplex[0].x;
  }
  const params = paramsFor(best),
    prediction = predict(params),
    residuals = errors(prediction),
    after = rms(residuals),
    warnings: string[] = [];
  if (after > before + 1e-6)
    warnings.push(
      "The bounded solution is worse than the current case. Review bounds and do not apply blindly.",
    );
  if (rejected)
    warnings.push(
      `${rejected} candidate sets were rejected because not every survey had a unique valid pressure root. The optimum is conditional on PVT coverage and the valid model domain.`,
    );
  if (!converged)
    warnings.push("Iteration limit reached; convergence is not established.");
  if (best.some((v) => v < 1e-4 || v > 1 - 1e-4))
    warnings.push(
      "A fitted parameter is at its bound. The data may prefer a value outside the bounds.",
    );
  const derivatives: number[][] = [];
  const sensitivity = bounds.map((b) => {
    let step = Math.max(
      Math.abs(params[b.key]) * 0.01,
      (b.max - b.min) * 0.001,
    );
    let effect = NaN;
    try {
      let d: number[] | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const lo = Math.max(b.min, params[b.key] - step),
          hi = Math.min(b.max, params[b.key] + step);
        let l: number[] | null = null,
          h: number[] | null = null;
        try {
          l = predict({ ...params, [b.key]: lo });
        } catch {
          /* Try the valid side of the PVT domain. */
        }
        try {
          h = predict({ ...params, [b.key]: hi });
        } catch {
          /* Try the valid side of the PVT domain. */
        }
        if (l && h) d = l.map((v, i) => (h![i] - v) / (hi - lo));
        else if (h && hi > params[b.key])
          d = h.map((v, i) => (v - prediction[i]) / (hi - params[b.key]));
        else if (l && lo < params[b.key])
          d = l.map((v, i) => (prediction[i] - v) / (params[b.key] - lo));
        if (d) {
          if (!l || !h)
            warnings.push(
              `Sensitivity for ${b.key} uses a one-sided difference at the valid PVT domain boundary.`,
            );
          break;
        }
        step /= 2;
      }
      if (!d) throw new Error("No valid perturbation");
      derivatives.push(d);
      effect = rms(d.map((v) => v * step));
    } catch {
      derivatives.push([]);
      warnings.push(
        `Sensitivity unavailable for ${b.key}: invalid or ambiguous pressure solution.`,
      );
    }
    return { key: b.key, step, rmsPressureChange: effect };
  });
  let correlation: number | null = null;
  if (derivatives.length === 2 && derivatives.every((v) => v.length)) {
    const [a, b] = derivatives,
      aa = a.reduce((s, x) => s + x * x, 0),
      bb = b.reduce((s, x) => s + x * x, 0);
    if (aa * bb > 1e-30)
      correlation =
        -a.reduce((s, x, i) => s + x * b[i], 0) / Math.sqrt(aa * bb);
  }
  if (correlation !== null && Math.abs(correlation) > 0.98)
    warnings.push(
      "Strong local parameter correlation: the pressure data do not uniquely separate inventory and support.",
    );
  if (derivatives.some((d) => d.length && d.every((v) => Math.abs(v) < 1e-12)))
    warnings.push(
      "At least one fitted parameter has negligible pressure sensitivity.",
    );
  return {
    params,
    before,
    after,
    mae: residuals.reduce((s, v) => s + Math.abs(v), 0) / residuals.length,
    evaluations,
    converged,
    warnings,
    correlation,
    sensitivity,
  };
}
