import type { HistoryRow, Parameters, PVTProvider, Scenario } from "../types";
export const tank: Parameters = {
  pi: 3000,
  temperature: 3 / 0.005035 - 459.67,
  N: 10e6,
  G: 10e9,
  m: 0.2,
  swi: 0.2,
  cf: 3e-6,
  cw: 3e-6,
  bw: 1,
  pb: 2000,
  rsi: 600,
  api: 35,
  gasGravity: 0.7,
  zi: null,
  caq: 500,
  injection: true,
  bwi: 1.1,
  bgi: 0.0012,
};
// Artificial analytic properties for algebra checks, independent of correlation implementation.
export const oilPVT: PVTProvider = (p) => ({
  pressure: p,
  bo: 1.2 + (3000 - p) * 0.0001,
  rs: 600 - (3000 - p) * 0.2,
  bg: 0.001 + (3000 - p) * 1e-6,
  bw: 1,
  z: 1,
});
export const gasPVT: PVTProvider = (p) => ({
  pressure: p,
  bo: 1,
  rs: 0,
  bg: 3 / p,
  bw: 1,
  z: 1,
});
export const empty: HistoryRow = {
  id: "fixture",
  date: "2020-01-01",
  np: 0,
  gp: 0,
  wp: 0,
  wi: 0,
  gi: 0,
  pressure: null,
  use: true,
};
export const fixture: Scenario = {
  version: 1,
  source: "synthetic",
  name: "Analytic test tank",
  model: "oil",
  units: "FIELD",
  params: tank,
  pvt: { mode: "correlation", table: [], extrapolate: false },
  aquifer: "none",
  history: [empty],
  display: { tab: "Dashboard", corrected: true, extrapolatePz: false },
};
export const knownOil = {
  Eo: 0.5,
  Eg: 0.24,
  Efw: 0.00648,
  Et: 0.74648,
  support: 7464800,
};
