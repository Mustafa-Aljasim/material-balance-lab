import type { Model, Scenario } from "../types";
import { makePVT } from "../engineering/pvt";
import { balanceAt } from "../engineering/pressureSolver";
export function demo(model: Model = "oil"): Scenario {
  const s: Scenario = {
    version: 1,
    source: "synthetic",
    name:
      model === "oil"
        ? "West Ridge · Oil depletion"
        : "North Basin · Dry gas depletion",
    model,
    units: "FIELD",
    params: {
      pi: 4200,
      temperature: 190,
      N: 85e6,
      G: 180e9,
      m: model === "oil" ? 0.18 : 0,
      swi: 0.22,
      cf: model === "oil" ? 3e-6 : 0,
      cw: model === "oil" ? 3e-6 : 0,
      bw: 1.03,
      pb: 2800,
      rsi: 650,
      api: 35,
      gasGravity: 0.7,
      zi: null,
      caq: 12000,
      injection: true,
      bwi: 1.03,
      bgi: null,
    },
    pvt: { mode: "correlation", table: [], extrapolate: false },
    aquifer: "none",
    history: [],
    display: { tab: "Dashboard", corrected: true, extrapolatePz: false },
  };
  const pvt = makePVT(s.pvt, s.params, model);
  // Prescribe pressure, then invert the balance algebraically for produced inventory.
  // Independent from the forward pressure root solver; exact synthetic surveys, no noise.
  for (let i = 0; i <= 16; i++) {
    const p = 4200 - i * (model === "oil" ? 155 : 175);
    const row = {
      id: `demo-${model}-${i}`,
      date: `${2020 + Math.floor(i / 4)}-${String(1 + (i % 4) * 3).padStart(2, "0")}-01`,
      np: 0,
      gp: 0,
      wp: 0,
      wi: 0,
      gi: 0,
      pressure: p,
      use: true,
    };
    const b = balanceAt(s, row, p, pvt);
    if (model === "oil") {
      const gor = s.params.rsi + i * 55,
        waterRatio = 0.12;
      row.np =
        b.support /
        (b.pvt.bo + (gor - b.pvt.rs) * b.pvt.bg + waterRatio * b.pvt.bw);
      row.gp = row.np * gor;
      row.wp = row.np * waterRatio;
    } else row.gp = b.support / b.pvt.bg;
    s.history.push(row);
  }
  return s;
}
