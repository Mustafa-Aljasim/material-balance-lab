import type { Balance, HistoryRow, Parameters, PVTProvider } from "../types";
import { waterInflux } from "./aquifer";
import { required } from "./pvt";
export function gasBalance(
  p: number,
  row: HistoryRow,
  a: Parameters,
  pvt: PVTProvider,
  aquifer: "none" | "pot",
): Balance {
  const v = pvt(p),
    initial = pvt(a.pi);
  const F =
    row.gp * required(v.bg, "Bg") +
    row.wp * v.bw -
    (a.injection
      ? row.wi * a.bwi + row.gi * (a.bgi ?? required(v.bg, "Bg"))
      : 0);
  const Eg = required(v.bg, "Bg") - required(initial.bg, "initial Bg");
  const Efw =
    ((required(initial.bg, "initial Bg") * (a.cf + a.swi * a.cw)) /
      (1 - a.swi)) *
    (a.pi - p);
  const Et = Eg + Efw,
    We = waterInflux(aquifer, a.caq, a.pi, p),
    gas = a.G * Eg,
    rock = a.G * Efw;
  const support = gas + rock + We;
  return {
    p,
    pvt: v,
    initial,
    F,
    Eo: 0,
    Eg,
    Efw,
    Et,
    We,
    oil: 0,
    gas,
    rock,
    support,
    closure: support - F,
    rp: null,
    indices: null,
  };
}
