import type { Balance, HistoryRow, Parameters, PVTProvider } from "../types";
import { waterInflux } from "./aquifer";
export function oilBalance(
  p: number,
  row: HistoryRow,
  a: Parameters,
  pvt: PVTProvider,
  aquifer: "none" | "pot",
): Balance {
  const v = pvt(p),
    initial = pvt(a.pi);
  // Algebraically expanded form avoids Gp/Np singularity at zero oil production.
  const F =
    row.np * v.bo +
    (row.gp - row.np * v.rs) * v.bg +
    row.wp * v.bw -
    (a.injection ? row.wi * a.bwi + row.gi * (a.bgi ?? v.bg) : 0);
  const Eo = v.bo - initial.bo + (initial.rs - v.rs) * v.bg;
  const Eg = a.m * initial.bo * (v.bg / initial.bg - 1);
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
    Efw,
    Et,
    We,
    oil,
    gas,
    rock,
    support,
    closure: support - F,
    rp: row.np ? row.gp / row.np : null,
    indices,
  };
}
