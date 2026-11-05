import type { Balance, HistoryRow, Parameters, PVTProvider } from "../types";
import { waterInflux } from "./aquifer";
import { required } from "./pvt";
export function oilBalance(
  p: number,
  row: HistoryRow,
  a: Parameters,
  pvt: PVTProvider,
  aquifer: "none" | "pot",
): Balance {
  const v = pvt(p),
    initial = pvt(a.pi);
  const simplifiedOil = v.rs === null || v.bg === null;
  if (
    simplifiedOil &&
    (a.m !== 0 ||
      p < a.pb ||
      a.pi < a.pb ||
      row.gp !== 0 ||
      (a.injection && row.gi > 0))
  )
    throw new Error(
      "Bo-only formulation requires no free-gas withdrawal/injection, m = 0 and p ≥ Pb. Associated solution gas is assumed to remain at constant Rs and cancels; supplied Gp cannot be ignored.",
    );
  // Algebraically expanded form avoids Gp/Np singularity at zero oil production.
  const F =
    row.np * v.bo +
    (simplifiedOil
      ? 0
      : (row.gp - row.np * required(v.rs, "Rs")) * required(v.bg, "Bg")) +
    row.wp * v.bw -
    (a.injection
      ? row.wi * a.bwi +
        (row.gi ? row.gi * (a.bgi ?? required(v.bg, "injected gas Bg")) : 0)
      : 0);
  const Eo =
    v.bo -
    initial.bo +
    (simplifiedOil
      ? 0
      : (required(initial.rs, "Rsi") - required(v.rs, "Rs")) *
        required(v.bg, "Bg"));
  const EgBase = simplifiedOil
    ? null
    : initial.bo *
      (required(v.bg, "Bg") / required(initial.bg, "initial Bg") - 1);
  const Eg = a.m === 0 ? 0 : a.m * required(EgBase, "gas-cap expansion");
  const Efw =
    (((1 + a.m) * initial.bo * (a.cf + a.swi * a.cw)) / (1 - a.swi)) *
    (a.pi - p);
  const Et = Eo + Eg + Efw,
    We = waterInflux(aquifer, a.caq, a.pi, p);
  const oil = a.N * Eo,
    gas = a.N * Eg,
    rock = a.N * Efw,
    support = oil + gas + rock + We;
  const indices: Balance["indices"] =
    Math.abs(F) < 1 ? null : [oil / F, gas / F, rock / F, We / F];
  return {
    p,
    pvt: v,
    initial,
    F,
    Eo,
    Eg,
    EgBase,
    rockBase: Efw / (1 + a.m),
    simplifiedOil,
    Efw,
    Et,
    We,
    oil,
    gas,
    rock,
    support,
    closure: support - F,
    rp: !simplifiedOil && row.np ? row.gp / row.np : null,
    indices,
  };
}
