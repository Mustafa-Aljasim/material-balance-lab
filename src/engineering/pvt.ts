import type { Parameters, PVT, PVTConfig, PVTProvider } from "../types";
export function sutton(gravity: number) {
  if (!(gravity >= 0.57 && gravity <= 1.68))
    throw new Error("Sutton gas gravity must be 0.57–1.68 (sweet gas).");
  return {
    tpc: 169.2 + 349.5 * gravity - 74 * gravity ** 2,
    ppc: 756.8 - 131 * gravity - 3.6 * gravity ** 2,
  };
}
export function dakZ(ppr: number, tpr: number): number {
  if (!(tpr >= 1.05 && tpr <= 3 && ppr >= 0.2 - 1e-12 && ppr <= 30 + 1e-12))
    throw new Error(
      "DAK requires 1.05 ≤ Tpr ≤ 3 and 0.2 ≤ Ppr ≤ 30. Near-critical/two-phase fluids are unsupported.",
    );
  const zOf = (r: number) =>
    1 +
    (0.3265 -
      1.07 / tpr -
      0.5339 / tpr ** 3 +
      0.01569 / tpr ** 4 -
      0.05165 / tpr ** 5) *
      r +
    (0.5475 - 0.7361 / tpr + 0.1844 / tpr ** 2) * r ** 2 -
    0.1056 * (-0.7361 / tpr + 0.1844 / tpr ** 2) * r ** 5 +
    ((0.6134 * (1 + 0.721 * r ** 2) * r ** 2) / tpr ** 3) *
      Math.exp(-0.721 * r ** 2);
  const f = (r: number) => r * zOf(r) - (0.27 * ppr) / tpr;
  let lo = 0,
    hi = 0.01;
  // First positive density root, i.e. the gas branch.
  while (f(hi) < 0 && hi < 8) {
    lo = hi;
    hi += 0.01;
  }
  if (hi >= 8) throw new Error("DAK density root not bracketed.");
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  const z = (0.27 * ppr) / ((tpr * (lo + hi)) / 2);
  if (!(z > 0 && Number.isFinite(z))) throw new Error("Invalid DAK Z-factor.");
  return z;
}
export function rawZ(p: number, a: Parameters): number {
  const { tpc, ppc } = sutton(a.gasGravity);
  return dakZ(p / ppc, (a.temperature + 459.67) / tpc);
}
export function correlationPVT(p: number, a: Parameters): PVT {
  if (!(
    p > 0 &&
    a.pi > 0 &&
    a.pb > 0 &&
    a.temperature >= 75 &&
    a.temperature <= 294 &&
    a.api >= 15.3 &&
    a.api <= 59.5 &&
    a.rsi >= 0 &&
    a.gasGravity <= 1.351
  ))
    throw new Error(
      "Correlation inputs require positive pressure, 75–294 °F, 15.3–59.5 °API, γgc ≤ 1.351, and nonnegative Rsi.",
    );
  if (a.pi < a.pb)
    throw new Error(
      "This oil correlation calibration requires pi ≥ Pb. For an initially saturated reservoir set Pb = pi or use a PVT table.",
    );
  const c =
    a.api <= 30
      ? [4.677e-4, 1.751e-5, -1.811e-8, 1.0937]
      : [4.67e-4, 1.1e-5, 1.337e-9, 1.187];
  // Vasquez–Beggs Rs is anchored to entered Rsi at Pb; the coefficient and exponential cancel in this ratio.
  const rs = a.rsi * Math.min(1, (p / a.pb) ** c[3]);
  const saturatedBo = (r: number) =>
    1 +
    c[0] * r +
    (((a.temperature - 60) * a.api) / a.gasGravity) * (c[1] + c[2] * r);
  const A =
    1e-5 *
    (5 * a.rsi +
      17.2 * a.temperature -
      1180 * a.gasGravity +
      12.61 * a.api -
      1433);
  if (A <= 0)
    throw new Error(
      "Vasquez–Beggs undersaturated compressibility is nonpositive for these inputs.",
    );
  const bo = p <= a.pb ? saturatedBo(rs) : saturatedBo(a.rsi) * (a.pb / p) ** A;
  const z = rawZ(p, a) * (a.zi === null ? 1 : a.zi / rawZ(a.pi, a));
  return {
    pressure: p,
    bo,
    rs,
    z,
    bg: (0.005035 * z * (a.temperature + 459.67)) / p,
    bw: a.bw,
  };
}
export function gasCorrelationPVT(p: number, a: Parameters): PVT {
  if (!(p > 0 && a.temperature > -459.67))
    throw new Error("Pressure and absolute temperature must be positive.");
  const z = rawZ(p, a) * (a.zi === null ? 1 : a.zi / rawZ(a.pi, a));
  return {
    pressure: p,
    bo: 1,
    rs: 0,
    z,
    bg: (0.005035 * z * (a.temperature + 459.67)) / p,
    bw: a.bw,
  };
}
export function validateTable(table: PVT[]): PVT[] {
  if (table.length < 2)
    throw new Error("PVT table needs at least two pressure rows.");
  const rows = [...table].sort((a, b) => a.pressure - b.pressure);
  rows.forEach((r, i) => {
    if (
      Object.values(r).some((x) => !Number.isFinite(x)) ||
      r.pressure <= 0 ||
      r.bo <= 0 ||
      r.bg <= 0 ||
      r.bw <= 0 ||
      r.z <= 0 ||
      r.rs < 0
    )
      throw new Error(
        "PVT values must be finite; pressure, FVFs and Z positive; Rs nonnegative.",
      );
    if (i && r.pressure === rows[i - 1].pressure)
      throw new Error("Duplicate PVT pressures are not permitted.");
  });
  return rows;
}
export function interpolatePVT(
  p: number,
  table: PVT[],
  extrapolate = false,
): PVT {
  const rows = table;
  if (!Number.isFinite(p) || p <= 0)
    throw new Error("PVT pressure must be positive and finite.");
  if (!extrapolate && (p < rows[0].pressure || p > rows.at(-1)!.pressure))
    throw new Error(
      `Pressure ${p.toFixed(2)} psia is outside PVT range ${rows[0].pressure}–${rows.at(-1)!.pressure} psia. Extrapolation is disabled.`,
    );
  // Provider construction validates ascending pressures once; bracket in O(log n).
  let low = 0,
    high = rows.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (rows[middle].pressure <= p) low = middle;
    else high = middle;
  }
  const i = low;
  const a = rows[i],
    b = rows[i + 1],
    t = (p - a.pressure) / (b.pressure - a.pressure);
  const value = (key: keyof PVT) => a[key] + t * (b[key] - a[key]);
  const result = {
    pressure: p,
    bo: value("bo"),
    rs: value("rs"),
    bg: value("bg"),
    bw: value("bw"),
    z: value("z"),
  };
  if (
    result.bo <= 0 ||
    result.bg <= 0 ||
    result.bw <= 0 ||
    result.z <= 0 ||
    result.rs < 0
  )
    throw new Error(
      "PVT interpolation/extrapolation produced nonphysical properties.",
    );
  return result;
}
export function makePVT(
  config: PVTConfig,
  a: Parameters,
  model: "oil" | "gas",
): PVTProvider {
  if (config.mode === "table") {
    const table = validateTable(config.table);
    return (p) => interpolatePVT(p, table, config.extrapolate);
  }
  const cache = new Map<number, PVT>();
  return (p) => {
    const known = cache.get(p);
    if (known) return known;
    const v = model === "oil" ? correlationPVT(p, a) : gasCorrelationPVT(p, a);
    cache.set(p, v);
    return v;
  };
}
